const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const command = process.argv[2];

switch (command) {
  case "init":
    createGitDirectory();
    break;
  case "cat-file":
    const hash = process.argv[process.argv.length - 1];
    if (!hash) {
      throw new Error("Hash is required as an argument for cat-file command");
    }
    catFile(hash);
    break;
  case "hash-object":
    const file = process.argv[4];
    createHash(path.join(file));
    break;
  case "ls-tree":
    createTree();
    break;
  default:
    throw new Error(`Unknown command ${command}`);
}

//this one creates a directory on --init
function createGitDirectory() {
  fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });

  fs.writeFileSync(
    path.join(process.cwd(), ".git", "HEAD"),
    "ref: refs/heads/main\n"
  );
}
async function catFile(hash) {
  const filePath = path.join(
    process.cwd(),
    ".git",
    "objects",
    hash.slice(0, 2),
    hash.slice(2)
  );

  try {
    const content = fs.readFileSync(filePath);
    const decompressed = zlib.unzipSync(content);
    const res = decompressed.toString().split("\0")[1];

    // Ensure only the result is printed, without additional logs
    process.stdout.write(res);
  } catch (error) {
    throw new Error("Error reading the object: " + error.message);
  }
}

function createHash(file) {
  const size = fs.statSync(file).size;
  const data = fs.readFileSync(file);
  const content = `blob ${size}\0${data.toString()}`;
  const blob = crypto.createHash("sha1").update(content).digest("hex");
  const objectDir = blob.slice(0, 2);
  const objectFile = blob.slice(2);
  fs.mkdirSync(path.join(process.cwd(), ".git", "objects", objectDir), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(process.cwd(), ".git", "objects", objectDir, objectFile),
    zlib.deflateSync(content)
  );
  process.stdout.write(`${blob}\n`);
}

function createTree() {
  const flag = process.argv[3]; // --name-only
  if (flag === "--name-only") {
    const hash = process.argv[4]; // The Git object hash
    const directory = hash.slice(0, 2); // First 2 chars of hash
    const fileName = hash.slice(2); // Remaining part of hash
    const filePath = path.join(
      process.cwd(),
      ".git",
      "objects",
      directory,
      fileName
    );

    try {
      // Read the compressed object file from .git/objects
      const data = fs.readFileSync(filePath);
      // Inflate (decompress) the file's contents
      const inflatedData = zlib.inflateSync(data);

      // Split the inflated data by null byte, filtering and handling only valid entries
      const entries = inflatedData.toString("utf-8").split("\x00");

      let output = [];
      let restOfData = entries.slice(1);

      for (let entry of restOfData) {
        let spaceIdx = entry.indexOf(" ");
        if (spaceIdx > 0) {
          // Find the second space, where the filename starts
          let fileNameIdx = entry.indexOf(" ", spaceIdx + 1);
          if (fileNameIdx > 0) {
            let fileName = entry.substring(fileNameIdx + 1).trim();
            output.push(fileName);
          }
        }
      }

      // Join all filenames and output them
      const outputString = output.join("\n") + "\n";
      process.stdout.write(outputString);
    } catch (error) {
      console.error("Error reading or processing the file:", error.message);
    }
  }
}
