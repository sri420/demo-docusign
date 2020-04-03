const docusign = require('docusign-esign')
    , path = require('path')
    , fs = require('fs')
    , process = require('process')
    , {promisify} = require('util') // http://2ality.com/2017/05/util-promisify.html
    , basePath = 'https://demo.docusign.net/restapi'
    , express = require('express')
    , envir = process.env
    ;

console.log('Before sendEnvelopeController...');
async function sendEnvelopeController (req, res) {
  const qp =req.query;
  console.log('Before  fetcing from envir...');
  // Fill in these constants or use query parameters of ACCESS_TOKEN, ACCOUNT_ID, USER_FULLNAME, USER_EMAIL
  // or environment variables.

  // Obtain an OAuth token from https://developers.docusign.com/oauth-token-generator
  const accessToken = envir.ACCESS_TOKEN || qp.ACCESS_TOKEN || '{ACCESS_TOKEN}';

  // Obtain your accountId from demo.docusign.com -- the account id is shown in the drop down on the
  // upper right corner of the screen by your picture or the default picture. 
  const accountId = envir.ACCOUNT_ID || qp.ACCOUNT_ID || '{ACCOUNT_ID}'; 

  // Recipient Information:
  const signerName = envir.USER_FULLNAME || qp.USER_FULLNAME || '{USER_FULLNAME}';
  const signerEmail = envir.USER_EMAIL || qp.USER_EMAIL || '{USER_EMAIL}';
 
  console.log(`accessToken: ${accessToken}`);
  console.log(`accountId: ${accountId}`);
  console.log(`signerName: ${signerName}`);
  console.log(`signerEmail: ${signerEmail}`);

  // The document you wish to send. Path is relative to the root directory of this repo.
  const fileName = 'demo_documents/World_Wide_Corp_lorem.pdf';

  console.log('Before apiClient ....');

  ////////////////////////////////////////////////////////////////////////////////
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(basePath);

  apiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);

  console.log('Before envelopesAPI...');
  // Set the DocuSign SDK components to use the apiClient object
  docusign.Configuration.default.setDefaultApiClient(apiClient);
  let envelopesApi = new docusign.EnvelopesApi()
      // createEnvelopePromise returns a promise with the results:
    , createEnvelopePromise = promisify(envelopesApi.createEnvelope).bind(envelopesApi)
    , results
    ;

  // Create the envelope request
  // Start with the request object
  const envDef = new docusign.EnvelopeDefinition();
  //Set the Email Subject line and email message
  envDef.emailSubject = 'Please sign this document sent from the Node example';
  envDef.emailBlurb = 'Please sign this document sent from the Node example.'

  // Read the file from the document and convert it to a Base64String
  const pdfBytes = fs.readFileSync(path.resolve(__dirname, fileName))
      , pdfBase64 = pdfBytes.toString('base64');
  
  // Create the document request object
  const doc = docusign.Document.constructFromObject({documentBase64: pdfBase64,
        fileExtension: 'pdf',  // You can send other types of documents too.
        name: 'Sample document', documentId: '1'});

  // Create a documents object array for the envelope definition and add the doc object
  envDef.documents = [doc];

  // Create the signer object with the previously provided name / email address
  const signer = docusign.Signer.constructFromObject({name: signerName,
        email: signerEmail, routingOrder: '1', recipientId: '1',clientUserId: 'AD123'});

  // Create the signHere tab to be placed on the envelope
  const signHere = docusign.SignHere.constructFromObject({documentId: '1',
        pageNumber: '1', recipientId: '1', tabLabel: 'SignHereTab',
        xPosition: '195', yPosition: '147'});

  // Create the overall tabs object for the signer and add the signHere tabs array
  // Note that tabs are relative to receipients/signers.
  signer.tabs = docusign.Tabs.constructFromObject({signHereTabs: [signHere]});

  // Add the recipients object to the envelope definition.
  // It includes an array of the signer objects. 
  envDef.recipients = docusign.Recipients.constructFromObject({signers: [signer]});
  // Set the Envelope status. For drafts, use 'created' To send the envelope right away, use 'sent'
  envDef.status = 'sent';


  try {
    console.log('Before createEnvelopePromise...');
    results = await createEnvelopePromise(accountId, {'envelopeDefinition': envDef})
    /**
     * Step 3. The envelope has been created.
     *         Request a Recipient View URL (the Signing Ceremony URL)
     */
    const envelopeId = results.envelopeId
        , recipientViewRequest = docusign.RecipientViewRequest.constructFromObject({
            authenticationMethod: 'None', clientUserId: 'AD123',
            recipientId: '1', returnUrl: 'http://localhost:5000/dsreturn',
            userName: signerName, email: signerEmail
          })
        , createRecipientViewPromise = promisify(envelopesApi.createRecipientView).bind(envelopesApi)
        ;

    results = await createRecipientViewPromise(accountId, envelopeId,
                      {recipientViewRequest: recipientViewRequest});
    /**
     * Step 4. The Recipient View URL (the Signing Ceremony URL) has been received.
     *         Redirect the user's browser to it.
     */

   console.log('results.url:  ' + results.url);
    res.redirect (results.url)
  } catch  (e) {
    // Handle exceptions
    let body = e.response && e.response.body;
    if (body) {
      // DocuSign API exception
      res.send (`<html lang="en"><body>
                  <h3>API problem</h3><p>Status code ${e.response.status}</p>
                  <p>Error message:</p><p><pre><code>${JSON.stringify(body, null, 4)}</code></pre></p>`);
    } else {
      // Not a DocuSign exception
      throw e;
    }
  }
}


// The mainline
const port = process.env.PORT || 5000
    , host = process.env.HOST || 'localhost'
    , app = express()
       .get('/', sendEnvelopeController)
       .listen(port, host);
console.log(`Your server is running on ${host}:${port}`);


