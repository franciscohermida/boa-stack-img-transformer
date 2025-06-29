import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imagePath = path.join(__dirname, "img.png");
const outputPath = path.join(__dirname, "thumbnail.jpg");

async function testImageTransform() {
  // Check if img.png exists
  try {
    await fs.access(imagePath);
  } catch (error) {
    console.error(`Error: 'img.png' not found in 'container_src' directory.`);
    console.log(
      `Please add an 'img.png' file to the 'container_src' directory to run this test.`
    );
    process.exit(1);
  }

  try {
    // 1. Define transform options for a thumbnail
    const input = {
      transform: {
        width: 150,
        height: 150,
        fit: "cover",
      },
      output: {
        format: "image/webp",
      },
    };

    // 2. Prepare the request URL
    const encodedInput = encodeURIComponent(JSON.stringify(input));
    const url = `http://localhost:3000/container/1?input=${encodedInput}`;

    // 3. Read the image file
    const imageBuffer = await fs.readFile(imagePath);

    // 4. Send the POST request
    console.log(`Sending request to resize image...`);
    const response = await fetch(url, {
      method: "POST",
      body: imageBuffer,
      headers: {
        "Content-Type": "image/png",
      },
    });

    if (!response.ok || !response.body) {
      const errorBody = await response.text();
      throw new Error(
        `Server responded with ${response.status}: ${response.statusText}. \n ${errorBody}`
      );
    }

    // 5. Save the resulting image
    const resultBuffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(resultBuffer));

    console.log(`Successfully created thumbnail at ${outputPath}`);
    console.log("Test finished successfully!");
  } catch (error) {
    if (
      error instanceof Error &&
      "cause" in error &&
      (error.cause as any)?.code === "ECONNREFUSED"
    ) {
      console.error("Connection refused. Is the server running?");
      console.log("Please run the server first with: pnpm dev:container");
    } else {
      console.error("An error occurred during the test:", error);
    }
    process.exit(1);
  }
}

testImageTransform();
