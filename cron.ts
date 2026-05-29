import cron from 'node-cron';
import { appendFile } from 'node:fs/promises';

/**
 * Professional Cron Task Wrapper
 * @param time - Cron syntax (e.g., '0 * * * *')
 * @param id - Unique identifier for the job
 * @param rawCallback - The function to execute (supports async)
 */
export default function createTask(time: string, id: string, rawCallback: () => void | Promise<void>) {

    // We use an async function so we can 'await' the callback and the file writing
    const callback = async () => {
        const timestamp = new Date().toISOString(); // ISO is standard for logs

        try {
            await rawCallback();

            // Success Log
            await appendFile("cron.log", `[${timestamp}] SUCCESS: job_id:${id}\n`);

        } catch (error) {
            // Failure Log: Capture the actual error message
            const msg = error instanceof Error ? error.message : "Unknown Error";
            await appendFile("cron.log", `[${timestamp}] ERROR: job_id:${id} - ${msg}\n`);

            // Pro Tip: In a real app, you'd also send an alert here (Email/Discord/Sentry)
            console.error(`Cron Job [${id}] failed:`, error);
        }
    };

    // Return the task so you can call .stop() or .start() elsewhere if needed
    return cron.schedule(time, callback, {
        timezone: "America/Indiana/Indianapolis",
       
    });
}