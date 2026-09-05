#!/usr/bin/env node
// İlk (veya ek) admin kullanıcısını güvenli biçimde oluşturur.
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/bootstrap-admin.mjs [email]
//
// Parola terminalde gizli (maskeli) olarak sorulur; hiçbir yerde
// loglanmaz veya dosyaya yazılmaz. service role anahtarını yalnızca bu
// scripti çalıştırırken, kendi makinenizde ortam değişkeni olarak
// kullanın — asla commit etmeyin veya sohbete yapıştırmayın.
import { createClient } from "@supabase/supabase-js";
import readline from "node:readline";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    [
      "SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenlerini ayarlamanız gerekiyor.",
      "Değerleri Supabase Dashboard > Project Settings > API bölümünden alabilirsiniz.",
      "",
      "Örnek:",
      '  SUPABASE_URL="https://xxxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="..." \\',
      "    node scripts/bootstrap-admin.mjs admin@ornek.com",
      "",
      "service role anahtarını asla commit etmeyin veya paylaşmayın.",
    ].join("\n"),
  );
  process.exit(1);
}

function ask(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

function askHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Önce soruyu normal şekilde yazdır, SONRA çıktı fonksiyonunu
    // maskele — aksi halde sorunun kendisi de yıldızlanır.
    rl.question(query, (value) => {
      rl.close();
      process.stdout.write("\n");
      resolve(value);
    });
    rl._writeToOutput = (stringToWrite) => {
      if (rl.stdoutMuted) rl.output.write("*");
      else rl.output.write(stringToWrite);
    };
    rl.stdoutMuted = true;
  });
}

async function main() {
  console.log("Fon Portföy — Admin Bootstrap\n");

  const email = (process.argv[2] || (await ask("Admin e-posta adresi: "))).trim();
  if (!email || !email.includes("@")) {
    console.error("Geçerli bir e-posta adresi girin.");
    process.exit(1);
  }

  const password = await askHidden("Admin parolası (en az 8 karakter): ");
  if (!password || password.length < 8) {
    console.error("Parola en az 8 karakter olmalı.");
    process.exit(1);
  }
  const confirmPassword = await askHidden("Parolayı tekrar girin: ");
  if (password !== confirmPassword) {
    console.error("Parolalar eşleşmiyor.");
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\nKullanıcı oluşturuluyor…");
  const { data: userData, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    console.error("Kullanıcı oluşturulamadı:", createErr.message);
    process.exit(1);
  }

  const userId = userData.user.id;

  const { error: insertErr } = await admin.from("admin_users").insert({
    id: userId,
    email,
    is_active: true,
  });

  if (insertErr) {
    console.error("Kullanıcı oluşturuldu ama admin_users kaydı eklenemedi:", insertErr.message);
    console.error(`Şu id ile manuel olarak ekleyebilirsiniz: ${userId}`);
    process.exit(1);
  }

  console.log(`\nAdmin kullanıcı başarıyla oluşturuldu: ${email}`);
  console.log("Artık /#/admin/giris üzerinden bu e-posta ve parolayla giriş yapabilirsiniz.");
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err);
  process.exit(1);
});
