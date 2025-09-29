import { setGlobalOptions } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK.
// This is required for backend services to interact with Firebase.
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// Set global options for the functions for performance and cost management.
setGlobalOptions({ maxInstances: 10 });

// Re-export existing functions if any.
import { getApiKey } from "./getApiKey";
export { getApiKey };

/**
 * A scheduled function that runs periodically to check for timers
 * that have been running for an extended period and sends a reminder
 * push notification to the user.
 */
export const checkLongRunningTimers = onSchedule(
  "every 60 minutes",
  async () => {
    logger.info("Starting check for long-running timers...");

    const now = Date.now();
    // Query all `runningSession` documents across all users.
    // The collection is 'status', and the document ID is 'runningSession'.
    const runningSessionsQuery = db.collectionGroup("status");

    try {
      const querySnapshot = await runningSessionsQuery.get();
      if (querySnapshot.empty) {
        logger.info("No running sessions found. Task complete.");
        return;
      }

      logger.info(`Found ${querySnapshot.size} running session(s) to check.`);

      for (const doc of querySnapshot.docs) {
        const session = doc.data();
        const userId = doc.ref.parent.parent?.id;

        if (!userId) {
          logger.warn("Found a running session with no parent user ID:",
            doc.id);
          continue;
        }

        // 1. Get the user's notification settings from Firestore.
        const settingsDoc = await db.collection("users").doc(userId)
          .collection("config").doc("settings").get();
        const settings = settingsDoc.data();

        // 2. Check if the user has reminders enabled.
        if (!settings?.enableSmartReminders) {
          logger.info(`User ${userId} has smart reminders disabled. Skipping.`);
          continue;
        }

        // Default to 4 hours if not set.
        const thresholdHours = settings.reminderThresholdHours || 4;
        const thresholdMillis = thresholdHours * 60 * 60 * 1000;

        // 3. Check if the session has been running longer than the threshold.
        if (now - session.startTs > thresholdMillis) {
          logger.info(
            `Session for user ${userId} on project "${session.projectName}" ` +
            `has been running for over ${thresholdHours} hours.`
          );

          // 4. Get the user's FCM registration tokens.
          const tokensSnapshot = await db.collection("users").doc(userId)
            .collection("fcmTokens").get();
          if (tokensSnapshot.empty) {
            logger.warn(
              `User ${userId} has a long-running timer but no FCM tokens.`
            );
            continue;
          }

          const tokens = tokensSnapshot.docs.map((tokenDoc) => tokenDoc.id);

          // 5. Construct and send the push notification.
          const messagePayload = {
            notification: {
              title: "Timer Still Running?",
              body: `Your timer for "${session.projectName}" has been ` +
                `active for over ${thresholdHours} hours.`,
            },
            tokens: tokens,
          };

          try {
            const response = await messaging.sendEachForMulticast(
              messagePayload
            );
            logger.info(
              `Successfully sent message to ${response.successCount} ` +
              `device(s) for user ${userId}.`
            );
            if (response.failureCount > 0) {
              logger.warn(
                `Failed to send to ${response.failureCount} device(s) for ` +
                `user ${userId}.`
              );
              // Optional: Add logic here to clean up invalid tokens.
            }
          } catch (error) {
            logger.error(
              `Error sending push notification to user ${userId}:`,
              error
            );
          }
        } else {
          logger.info(
            `Session for user ${userId} is within the ` +
            `${thresholdHours}-hour threshold.`
          );
        }
      }
    } catch (error) {
      logger.error(
        "A critical error occurred while querying for long-running timers:",
        error
      );
    }
  });
