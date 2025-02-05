#!/usr/bin/env node
import { z } from "zod";
import * as fs from "fs/promises";

// Zod schemas for the file format
const FileSchema = z.object({
  file_name: z.string(),
});

const ContentSchema = z.object({
  start_timestamp: z.string().nullable(),
  stop_timestamp: z.string().nullable(),
  type: z.string(),
  text: z.string().optional(),
});

const ChatMessageSchema = z.object({
  uuid: z.string(),
  text: z.string(),
  content: z.array(ContentSchema),
  sender: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  attachments: z.array(z.any()),
  files: z.array(FileSchema),
});

const AccountSchema = z.object({
  uuid: z.string(),
});

const ConversationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  account: AccountSchema,
  chat_messages: z.array(ChatMessageSchema),
});

const ChatHistorySchema = z.array(ConversationSchema);

// Helper to format dates
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString();
}

// A naive token counter (using whitespace splitting)
function countTokens(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

// Options interface (added tokens flag)
interface Options {
  verbose: boolean;
  list: boolean;
  conversationNumber?: number;
  inputCost?: number;
  outputCost?: number;
  tokens?: boolean;
}

// Print usage information
function printUsage() {
  console.log(`
Usage: exparse [-hlv] [-n N] [-i C] [-o C] [-t] conversations.json

Options:
  -h, --help            Show this help message
  -l                    List conversations
  -v                    Verbose output
  -n N                  Only display conversation N
  -i C                  Cost per million input tokens (default: 3)
  -o C                  Cost per million output tokens (default: 15)
  -t                    Show token cost details (implies -l)

With no flags, displays total number of conversations.
With -l flag, lists numbered conversations.
With -lv flags, lists conversations with details.
`);
}

// Parse command line arguments
function parseArgs(): { options: Options; file: string } {
  const options: Options = {
    verbose: false,
    list: false,
  };
  const args = process.argv.slice(2);
  let file: string | null = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "-l":
        options.list = true;
        break;
      case "-v":
        options.verbose = true;
        break;
      case "-t":
        options.tokens = true;
        options.list = true; // -t implies listing
        break;
      case "-n":
        const n = parseInt(args[++i]);
        if (isNaN(n) || n < 1) {
          console.error("Error: -n requires a positive number");
          process.exit(1);
        }
        options.conversationNumber = n;
        break;
      case "-i":
        const inputCost = parseFloat(args[++i]);
        if (isNaN(inputCost) || inputCost < 0) {
          console.error("Error: -i requires a positive number");
          process.exit(1);
        }
        options.inputCost = inputCost;
        break;
      case "-o":
        const outputCost = parseFloat(args[++i]);
        if (isNaN(outputCost) || outputCost < 0) {
          console.error("Error: -o requires a positive number");
          process.exit(1);
        }
        options.outputCost = outputCost;
        break;
      default:
        if (!args[i].startsWith("-") && file === null) {
          file = args[i];
        } else {
          console.error("Error: Invalid argument or multiple files specified");
          printUsage();
          process.exit(1);
        }
    }
  }

  if (file === null) {
    console.error("Error: No input file specified");
    printUsage();
    process.exit(1);
  }

  return { options, file };
}

// Process one conversation.
// This function always computes a token-cost breakdown for the conversation and
// returns an object with the final accumulated input and output token counts.
function processConversation(
  conversation: z.infer<typeof ConversationSchema>,
  number: number,
  options: Options,
): { accInput: number; accOutput: number } {
  // Compute totals over the conversation.
  let runningHistory = 0; // the cumulative token count (the full conversation so far)
  let accInput = 0; // accumulate input cost (for human messages)
  let accOutput = 0; // accumulate output cost (for assistant messages)

  // First, compute per-message costs.
  conversation.chat_messages.forEach((msg) => {
    const msgTokens = countTokens(msg.text);
    const newHistory = runningHistory + msgTokens;
    if (msg.sender.toLowerCase() === "human") {
      // For a human message, assign the full updated history as the input cost.
      accInput += newHistory;
    } else {
      // For an assistant message, assign its token count as the output cost.
      accOutput += msgTokens;
    }
    runningHistory = newHistory;
  });

  // Compute cost dollars
  const inputRate = options.inputCost ?? 3.0; // dollars per million input tokens
  const outputRate = options.outputCost ?? 15.0; // dollars per million output tokens
  const totalCostDollars =
    (accInput / 1e6) * inputRate + (accOutput / 1e6) * outputRate;

  // In list view, print a header line with the conversation number, title, and cost.
  // Format: <number>  "<conversation name>" $<cost>
  console.log(
    `${number}  "${conversation.name}" $${totalCostDollars.toFixed(2)}`,
  );

  // If verbose or tokens details are requested, print the per-message breakdown.
  if (options.tokens || options.verbose) {
    let runningHistory2 = 0;
    let localAccInput = 0;
    let localAccOutput = 0;
    conversation.chat_messages.forEach((msg) => {
      const msgTokens = countTokens(msg.text);
      const newHistory = runningHistory2 + msgTokens;
      if (msg.sender.toLowerCase() === "human") {
        const inputCost = newHistory;
        localAccInput += inputCost;
        console.log(
          `  human: msg=${msgTokens} input=${inputCost} output=0 acc-input=${localAccInput} acc-output=${localAccOutput}`,
        );
      } else {
        const outputCost = msgTokens;
        localAccOutput += outputCost;
        console.log(
          `  assistant: msg=${msgTokens} input=0 output=${outputCost} acc-input=${localAccInput} acc-output=${localAccOutput}`,
        );
      }
      runningHistory2 = newHistory;
    });

    // Print a detailed cost summary for this conversation.
    console.log(
      `  costs: input=$${inputRate}/MTok output=$${outputRate}/MTok input-costs=$${(
        (localAccInput / 1e6) *
        inputRate
      ).toFixed(2)} output-costs=$${(
        (localAccOutput / 1e6) *
        outputRate
      ).toFixed(2)} total-cost=$${(
        (localAccInput / 1e6) * inputRate +
        (localAccOutput / 1e6) * outputRate
      ).toFixed(2)}`,
    );
    console.log();
  }

  return { accInput, accOutput };
}

// Main function
async function main() {
  const { options, file } = parseArgs();

  try {
    const fileContent = await fs.readFile(file, { encoding: "utf-8" });
    const data = JSON.parse(fileContent);
    const chatHistory = ChatHistorySchema.parse(data);

    // If no listing/verbose flags and no specific conversation requested, show count.
    if (!options.list && !options.verbose && !options.conversationNumber) {
      console.log(chatHistory.length);
      return;
    }

    // If a specific conversation is requested.
    if (options.conversationNumber) {
      const idx = options.conversationNumber - 1;
      if (idx >= chatHistory.length) {
        console.error(
          `Error: Conversation ${options.conversationNumber} does not exist`,
        );
        process.exit(1);
      }
      processConversation(
        chatHistory[idx],
        options.conversationNumber,
        options,
      );
      return;
    }

    // Otherwise, process all conversations.
    let grandTotalInput = 0;
    let grandTotalOutput = 0;
    for (let idx = 0; idx < chatHistory.length; idx++) {
      const totals = processConversation(chatHistory[idx], idx + 1, options);
      grandTotalInput += totals.accInput;
      grandTotalOutput += totals.accOutput;
    }

    // If the tokens flag is set, print an overall summary after a blank line.
    if (options.tokens) {
      console.log();
      const inputRate = options.inputCost ?? 3.0;
      const outputRate = options.outputCost ?? 15.0;
      const totalInputCostDollars = (grandTotalInput / 1e6) * inputRate;
      const totalOutputCostDollars = (grandTotalOutput / 1e6) * outputRate;
      const overallCostDollars = totalInputCostDollars + totalOutputCostDollars;
      console.log(`Total costs:`);
      console.log(`  input: $${inputRate}/MTok`);
      console.log(`  output: $${outputRate}/MTok`);
      console.log(`  input tokens: ${grandTotalInput.toLocaleString()}`);
      console.log(`  input costs: $${totalInputCostDollars.toFixed(2)}`);
      console.log(`  output tokens: ${grandTotalOutput.toLocaleString()}`);
      console.log(`  output costs: $${totalOutputCostDollars.toFixed(2)}`);
      console.log(`  total costs: $${overallCostDollars.toFixed(2)}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation errors:");
      error.errors.forEach((err) => {
        console.error("\nPath:", err.path.join("."));
        console.error("Code:", err.code);
        console.error("Message:", err.message);
      });
    } else {
      console.error("Error reading or processing file:", error);
    }
    process.exit(1);
  }
}

main();
