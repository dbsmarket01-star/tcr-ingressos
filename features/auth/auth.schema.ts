import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  password: z.string().min(8, "Informe sua senha.")
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8, "Informe sua senha atual."),
    newPassword: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(8, "Confirme a nova senha.")
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "A confirmacao da senha nao confere.",
    path: ["confirmPassword"]
  });

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido.")
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32, "Token invalido."),
    newPassword: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(8, "Confirme a nova senha.")
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "A confirmacao da senha nao confere.",
    path: ["confirmPassword"]
  });
