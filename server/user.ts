import bcrypt from "bcryptjs";

export async function verifyCredentials(inEmail: string, inPassword: string): Promise<boolean> {
  const email = process.env.SEED_EMAIL ?? "";
  const hash = process.env.SEED_PASSWORD_HASH
    ?? bcrypt.hashSync(process.env.SEED_PASSWORD ?? "", 8);
  if (!email || inEmail !== email) return false;
  return bcrypt.compareSync(inPassword, hash);
}
