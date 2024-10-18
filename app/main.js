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
  console.log("Initialized git directory");
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
  const flag = process.argv[3];
  if (flag === "--name-only") {
    const hash = process.argv[4];
    if (!hash) {
      console.error("Hash not provided");
    }
    const directory = hash.slice(0, 2);
    const fileName = hash.slice(2);
    const filePath = path.join(
      process.cwd(),
      ".git",
      "objects",
      directory,
      fileName
    );

    const data = fs.readFileSync(filePath);
    const inflatedData = zlib.inflateSync(data);
    const entries = inflatedData.toString("utf-8").split("\x00");
    const dataFromTree = entries.slice(1);
    // console.log(dataFromTree);
    const names = dataFromTree
      .filter((name) => name.includes(" "))
      .map((line) => line.split(" ")[1]);
    // console.log(names);
    const nameString = names.join("\n");
    const output = nameString.concat("\n");
    // console.log(nameString.concat("\n"));
    process.stdout.write(output.replace(/\n\n/g, "\n"));
  }
}
