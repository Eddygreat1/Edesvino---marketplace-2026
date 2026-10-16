import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://eddygreat1.github.io",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "POST requests only." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !serviceRoleKey || !paystackSecret) {
      return jsonResponse(
        { error: "Payment service configuration is incomplete." },
        500,
      );
    }

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Please sign in first." }, 401);
    }

    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false },
      },
    );

    const token = authorization.slice("Bearer ".length);
    const { data: userData, error: userError } =
      await userClient.auth.getUser(token);

    if (userError || !userData.user) {
      return jsonResponse({ error: "Your session is invalid." }, 401);
    }

    const user = userData.user;

    if (!user.email) {
      return jsonResponse(
        { error: "Your account needs an email address for payment." },
        400,
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const action = body.action;
    const orderId = Number(body.order_id);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return jsonResponse({ error: "Invalid order ID." }, 400);
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(
        "id, customer_id, total_amount, payment_status, payment_reference",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("Order lookup failed:", orderError.message);
      return jsonResponse({ error: "Could not load the order." }, 500);
    }

    if (!order || order.customer_id !== user.id) {
      return jsonResponse({ error: "Order not found." }, 404);
    }

    const amount = Number(order.total_amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: "Invalid order amount." }, 400);
    }

    const amountInKobo = Math.round(amount * 100);

    if (
      !Number.isSafeInteger(amountInKobo) ||
      Math.abs(amount * 100 - amountInKobo) > 0.001
    ) {
      return jsonResponse({ error: "Invalid payment amount." }, 400);
    }

    if (action === "initialize") {
      if (order.payment_status === "success") {
        return jsonResponse({ error: "This order is already paid." }, 409);
      }

      const origin = req.headers.get("origin");

      if (origin !== "https://eddygreat1.github.io") {
        return jsonResponse({ error: "Invalid website origin." }, 403);
      }

      const paystackResponse = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.email,
            amount: amountInKobo,
            currency: "NGN",
            callback_url:
              "https://eddygreat1.github.io/Edesvino---marketplace-2026/checkout.html",
            metadata: {
              order_id: order.id,
              customer_id: user.id,
            },
          }),
        },
      );

      const payment = await paystackResponse.json();

      if (!paystackResponse.ok || !payment.status || !payment.data?.reference) {
        console.error("Paystack initialization failed:", payment.message);
        return jsonResponse(
          { error: "Paystack could not start the payment." },
          502,
        );
      }

      const { error: updateError } = await admin
        .from("orders")
        .update({
          payment_reference: payment.data.reference,
          payment_status: "pending",
        })
        .eq("id", order.id)
        .eq("customer_id", user.id);

      if (updateError) {
        console.error("Could not save payment reference:", updateError.message);
        return jsonResponse(
          { error: "Could not save the payment reference." },
          500,
        );
      }

      return jsonResponse({
        authorization_url: payment.data.authorization_url,
        reference: payment.data.reference,
        order_id: order.id,
      });
    }

    if (action === "verify") {
      const reference = String(body.reference ?? "").trim();

      if (!reference || reference !== order.payment_reference) {
        return jsonResponse({ error: "Payment reference mismatch." }, 400);
      }

      if (order.payment_status === "success") {
        return jsonResponse({ success: true, message: "Payment already verified." });
      }

      const verifyResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
          },
        },
      );

      const verification = await verifyResponse.json();
      const transaction = verification.data;

      if (
        !verifyResponse.ok ||
        !verification.status ||
        transaction?.status !== "success" ||
        transaction?.reference !== reference ||
        transaction?.currency !== "NGN" ||
        Number(transaction?.amount) !== amountInKobo
      ) {
        return jsonResponse({
          success: false,
          message: "Payment is not verified. Please check the transaction.",
        }, 400);
      }

      const { data: updatedOrder, error: updateError } = await admin
        .from("orders")
        .update({ payment_status: "success" })
        .eq("id", order.id)
        .eq("customer_id", user.id)
        .eq("payment_reference", reference)
        .neq("payment_status", "success")
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("Payment status update failed:", updateError.message);
        return jsonResponse(
          { error: "Payment was verified, but the order update failed." },
          500,
        );
      }

      return jsonResponse({
        success: true,
        message: "Payment verified successfully.",
        order_id: updatedOrder?.id ?? order.id,
      });
    }

    return jsonResponse({ error: "Unknown payment action." }, 400);
  } catch (error) {
    console.error("Payment function error:", error);
    return jsonResponse({ error: "An unexpected payment error occurred." }, 500);
  }
});
