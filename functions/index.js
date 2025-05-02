/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const midtransClient = require("midtrans-client"); // Midtrans SDK
const cors = require("cors")({origin: true}); // Enable CORS


// Initialize Firebase Admin
admin.initializeApp();
require("./otp"); // Menambahkan file otp.js

exports.createTransaction = functions.https.onRequest((req, res) => {
  // Enable CORS
  cors(req, res, async () => {
    const {orderId, amount, customerName, email, items, phone, tableNumber} = req.body;

    // Validate input
    if (!orderId || !amount) {
      return res.status(400).send({error: "Missing required fields: orderId or amount"});
    }

    if (!customerName) {
      return res.status(400).send({error: "Missing required field: customerName"});
    }

    if (!email) {
      return res.status(400).send({error: "Missing required field: email"});
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).send({error: "Missing or invalid items data"});
    }

    try {
      // Prepare Midtrans parameter
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount,
        },
        customer_details: {
          first_name: customerName,
          email: email,
        },
        item_details: items.map((item) => ({
          id: item.productId || "default",
          price: item.price,
          quantity: item.quantity,
          name: item.name,
        })),
      };

      // Initialize Midtrans Snap API
      const snap = new midtransClient.Snap({
        isProduction: false,
        serverKey: "SB-Mid-server-dRSvxJSrwvwoxFIQfOnRh3Qb", // Replace with your actual server key
      });

      // Create transaction in Midtrans
      const chargeResponse = await snap.createTransaction(parameter);

      // Only after the Midtrans transaction is successful, save to Firestore
      const orderData = {
        orderId: orderId,
        amount: amount,
        customerName: customerName,
        email: email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        phone: phone,
        tableNumber: tableNumber,
        status: "on-proggress", // Set the order status to "pending" after successful payment
      };

      // Save order data to Firestore
      await admin.firestore().collection("orders").add(orderData);

      // Save transaction details to Firestore
      const transactionDetailsPromises = items.map((item) => {
        if (!item.quantity || !item.price) {
          console.warn(`Item with orderId: ${orderId} has invalid quantity or price`);
          return null; // Skip invalid item
        }

        const total = item.quantity * item.price;

        const transactionData = {
          orderId: orderId,
          productName: item.name,
          price: item.price,
          quantity: item.quantity,
          total: total,
          code: item.code !== undefined ? item.code : null,
        };

        return admin.firestore().collection("transactionDetails").add(transactionData);
      }).filter((promise) => promise !== null); // Filter out null values

      // Wait for all transaction details to be saved
      await Promise.all(transactionDetailsPromises);

      // Return Midtrans charge response
      res.send(chargeResponse);
    } catch (err) {
      console.error("Error creating transaction:", err);
      res.status(500).send({error: err.message});

      // If there was an error, delete the order and transaction details if any were added
      await admin.firestore().collection("orders").doc(orderId).delete();
      // Optional: You can also delete any transactionDetails if they were already created
      const transactionSnapshot = await admin.firestore().collection("transactionDetails").where("orderId", "==", orderId).get();
      transactionSnapshot.forEach((doc) => {
        doc.ref.delete();
      });
    }
  });
});

