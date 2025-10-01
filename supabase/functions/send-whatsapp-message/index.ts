import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, content, messageType = "text", fileUrl } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configurações da Evolution API
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["evolution_api_url", "evolution_api_key"]);

    const apiUrl = settings?.find(s => s.key === "evolution_api_url")?.value;
    const apiKey = settings?.find(s => s.key === "evolution_api_key")?.value;

    if (!apiUrl || !apiKey) {
      throw new Error("Evolution API não configurada");
    }

    // Buscar dados da conversa
    const { data: conversation } = await supabase
      .from("conversations")
      .select("customer_phone")
      .eq("id", conversationId)
      .single();

    if (!conversation?.customer_phone) {
      throw new Error("Número de telefone não encontrado");
    }

    // Preparar payload para Evolution API
    let payload: any = {
      number: conversation.customer_phone,
    };

    if (messageType === "text") {
      payload.text = content;
    } else if (messageType === "image" || messageType === "document") {
      payload.mediatype = messageType;
      payload.media = fileUrl;
      if (content) payload.caption = content;
    }

    // Enviar mensagem via Evolution API
    const response = await fetch(`${apiUrl}/message/sendText/iatende`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Erro Evolution API:", error);
      throw new Error("Falha ao enviar mensagem");
    }

    const result = await response.json();
    console.log("Mensagem enviada:", result);

    // Salvar mensagem no banco
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      content,
      sender_type: "agent",
      sender_id: user?.id,
      message_type: messageType,
      file_url: fileUrl,
    });

    // Atualizar última mensagem da conversa
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
