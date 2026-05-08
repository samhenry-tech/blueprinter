import delay from "delay";
import ora from "ora";

const DEFAULT_TIMEOUT = 1500;

export const displayNewLines = (count: number) =>
  console.log("\n".repeat(count - 1));


export const displayMessage = async (message: string, timeout: number = DEFAULT_TIMEOUT) => {
  const spinner = ora(message).start();

  await delay(timeout);
  spinner.stopAndPersist();
};

export const waitWithMessage = async <T>(
  promise: Promise<T>,
  message: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<T> => {
  const spinner = ora(message).start();
  const [result] = await Promise.all([promise, delay(timeout)]);
  spinner.stopAndPersist();
  return result;
};
