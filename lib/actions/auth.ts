"use server";

import { redirect } from "next/navigation";
import { prisma } from "../db";
import { newOtp, setSession, clearSession } from "../session";

function fail(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function requestCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a real email address.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing && name.length < 3) {
    redirect(`/login?email=${encodeURIComponent(email)}&needName=1`);
  }
  if (!existing) {
    await prisma.user.create({ data: { email, name } });
  }

  const code = newOtp();
  await prisma.otpCode.create({
    data: {
      email,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  redirect(`/login?email=${encodeURIComponent(email)}&sent=1`);
}

export async function verifyCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const row = await prisma.otpCode.findFirst({
    where: { email, code, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) fail("That code has expired, or it is not the one on the desk.");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) fail("Start again with your email.");
  await setSession(user.id);
  redirect("/homes");
}

export async function logout() {
  await clearSession();
  redirect("/");
}
