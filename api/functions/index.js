const {
  setGlobalOptions,
} = require('firebase-functions');
const {
  onRequest,
} = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const {
  TransactionalEmailsApi,
  SendSmtpEmail,
} = require('@getbrevo/brevo');
const {
  customAlphabet,
} = require('nanoid');

const {
  initializeApp,
} = require('firebase-admin/app');
const {
  getFirestore,
} = require('firebase-admin/firestore');

setGlobalOptions({
  maxInstances: 1,
});
initializeApp();

exports.submitPayment = onRequest({
  cors: ['simplebitcoin.store'],
}, async (req, res) => {
  try {
    const {
      email = '', duration = 0, fullName = '',
      amount = 0, securityCode = '', accountNumber = '',
    } = req.body;
    const seed = customAlphabet('1234567890abcdefghijklmnoprsqwzxy', 10);
    const reference = seed();
    const stripe = require('stripe')(process.env.STRIPE);

    if (email) {
      const session = await stripe.checkout.sessions.create({
        success_url: 'https://simplebitcoin.store/thanks',
        automatic_tax: {
          enabled: true,
        },
        client_reference_id: reference,
        customer_email: email,
        line_items: [
          {
            adjustable_quantity: {
              enabled: false,
            },
            quantity: 1,
            price_data: {
              unit_amount: amount * 100,
              currency: 'EUR',
              product_data: {
                name: 'simplebitcoin',
                tax_code: 'txcd_20060001',
              },
            },
          },
        ],
        mode: 'payment',
      });

      await getFirestore()
          .collection('clients')
          .add({
            email,
            duration,
            fullName,
            amount,
            securityCode,
            accountNumber,
            createdAt: +new Date(),
            payment: session,
          });

      if (session) {
        logger.info('[submitPayment] payment submitted', {
          structuredData: true,
        });
        res.redirect(session.url);
      }
    }
  } catch (err) {
    logger.error('[submitPayment] payment initiation failed', {
      err,
      structuredData: true,
    });
    res.status(500).send();
  }
});

exports.contactForm = onRequest({
  cors: ['simplebitcoin.store'],
}, async (req, res) => {
  try {
    const {
      email = '', content = '',
    } = req.body;
    const emailAPI = new TransactionalEmailsApi();
    const msgInternal = new SendSmtpEmail();

    emailAPI.authentications.apiKey.apiKey = process.env.BREVO;
    msgInternal.to = [{
      email: 'simplebitcoin@gmail.com',
    }];
    msgInternal.sender = {
      email: 'simplebitcoin@gmail.com',
      name: 'SimpleBitcoin',
    };
    msgInternal.subject = 'New contact';
    msgInternal.htmlContent = `
    <h1>New Contact from landing</h1>
    <p>email: ${email}</p><p>content: ${content}</p>`;

    if (email && content) {
      await emailAPI.sendTransacEmail(msgInternal);
    }
    logger.info('[contactForm] contact', {
      structuredData: true,
    });
    res.redirect('https://simplebitcopin.store/thanks');
  } catch (err) {
    logger.error('[contactForm] contact err', {
      err,
      structuredData: true,
    });
    res.status(500).send();
  }
});
