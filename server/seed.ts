import "dotenv/config";
import { seedPersonalData } from "./seedData";

async function main() {
  await seedPersonalData();
  console.log("seed complete");
  process.exit(0);
}
main();
