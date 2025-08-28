import * as functions from "firebase-functions";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import cors from "cors"; // <-- FIX 1: Use a default import

const client = new SecretManagerServiceClient();

// BEST PRACTICE: Initialize the cors middleware with options
// origin: true allows the function to accept requests from any origin
const corsHandler = cors({ origin: true });

// It's safer to get the project ID dynamically
const secretName = `projects/${process.env.GCLOUD_PROJECT}/secrets/` +
  "buztracker-project-key/versions/latest";

export const getApiKey = functions.https.onRequest(async (req, res) => {
  // FIX 2: Use the initialized cors handler
  corsHandler(req, res, async () => {
    try {
      const [version] = await client.accessSecretVersion({
        name: secretName,
      });

      // Defensive check for the payload and its data
      if (!version.payload?.data) {
        functions.logger.error("Secret payload data is missing.");
        res.status(500).send("Failed to retrieve secret: data missing");
        return;
      }

      const apiKey = version.payload.data.toString("utf8");

      res.status(200).send({ apiKey });
    } catch (error) {
      functions.logger.error("Failed to retrieve secret.", error);
      res.status(500).send("Failed to retrieve secret.");
    }
  });
});

