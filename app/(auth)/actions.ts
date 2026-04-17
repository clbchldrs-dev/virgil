"use server";

import { z } from "zod";

import { createUser, getUser } from "@/lib/db/queries";
import { isPasswordlessLoginConfigured } from "@/lib/passwordless-login";
import { generateUUID } from "@/lib/utils";

import { signIn } from "./auth";

const emailOnlySchema = z.object({
  email: z.string().email(),
});

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    if (isPasswordlessLoginConfigured()) {
      const validatedData = emailOnlySchema.parse({
        email: formData.get("email"),
      });
      await signIn("passwordless", {
        email: validatedData.email,
        redirect: false,
      });
    } else {
      const validatedData = authFormSchema.parse({
        email: formData.get("email"),
        password: formData.get("password"),
      });
      await signIn("credentials", {
        email: validatedData.email,
        password: validatedData.password,
        redirect: false,
      });
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    if (isPasswordlessLoginConfigured()) {
      const validatedData = emailOnlySchema.parse({
        email: formData.get("email"),
      });
      const [existing] = await getUser(validatedData.email);
      if (existing) {
        return { status: "user_exists" } as RegisterActionState;
      }
      await createUser(validatedData.email, generateUUID());
      await signIn("passwordless", {
        email: validatedData.email,
        redirect: false,
      });
    } else {
      const validatedData = authFormSchema.parse({
        email: formData.get("email"),
        password: formData.get("password"),
      });
      const [user] = await getUser(validatedData.email);
      if (user) {
        return { status: "user_exists" } as RegisterActionState;
      }
      await createUser(validatedData.email, validatedData.password);
      await signIn("credentials", {
        email: validatedData.email,
        password: validatedData.password,
        redirect: false,
      });
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};
