function main() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    console.log(`Hello, ${args[0]}!`);
  } else {
    console.log("Hello World!");
  }
}

main();
