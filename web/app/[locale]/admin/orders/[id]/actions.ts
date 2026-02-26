"use server";

import { updateAdminOrderStatus } from "@/lib/api";
import { revalidatePath } from "next/cache";

export async function updateStatus(orderId: string, status: string) {
  try {
    await updateAdminOrderStatus(orderId, status);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { success: true };
  } catch (error) {
    console.error("Failed to update status:", error);
    return { success: false, error: (error as Error).message };
  }
}
