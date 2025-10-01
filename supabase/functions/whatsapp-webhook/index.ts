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
    const payload = await req.json();
    console.log("Webhook recebido:", JSON.stringify(payload, null, 2));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Processar mensagens recebidas
    if (payload.event === "messages.upsert") {
      const message = payload.data;
      
      // Ignorar mensagens enviadas pelo bot
      if (message.key.fromMe) {
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const phoneNumber = message.key.remoteJid.replace("@s.whatsapp.net", "");
      const customerName = message.pushName || phoneNumber;
      
      // Buscar ou criar conversa
      let { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("customer_phone", phoneNumber)
        .single();

      if (!conversation) {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            customer_name: customerName,
            customer_phone: phoneNumber,
            channel: "whatsapp",
            status: "open",
          })
          .select()
          .single();
        conversation = newConv;
      }

      if (!conversation) {
        throw new Error("Falha ao criar conversa");
      }

      // Extrair conteúdo da mensagem
      let content = "";
      let messageType = "text";
      let fileUrl = null;

      if (message.message?.conversation) {
        content = message.message.conversation;
      } else if (message.message?.extendedTextMessage) {
        content = message.message.extendedTextMessage.text;
      } else if (message.message?.imageMessage) {
        content = message.message.imageMessage.caption || "[Imagem]";
        messageType = "image";
        fileUrl = message.message.imageMessage.url;
      } else if (message.message?.documentMessage) {
        content = message.message.documentMessage.caption || "[Documento]";
        messageType = "document";
        fileUrl = message.message.documentMessage.url;
      } else if (message.message?.audioMessage) {
        content = "[Áudio]";
        messageType = "audio";
        fileUrl = message.message.audioMessage.url;
      }

      // Salvar mensagem
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        content,
        sender_type: "customer",
        message_type: messageType,
        file_url: fileUrl,
      });

      // Atualizar conversa
      await supabase
        .from("conversations")
        .update({ 
          last_message_at: new Date().toISOString(),
          status: "open"
        })
        .eq("id", conversation.id);

      // Processar resposta automática com IA
      const { data: botResponses } = await supabase
        .from("bot_responses")
        .select("*")
        .eq("is_active", true);

      // Verificar se há resposta automática para palavras-chave
      const lowerContent = content.toLowerCase();
      const matchedResponse = botResponses?.find(
        br => lowerContent.includes(br.keyword.toLowerCase())
      );

      if (matchedResponse) {
        // Enviar resposta automática
        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          content: matchedResponse.response_text,
          sender_type: "bot",
        });

        // Enviar via Evolution API
        const { data: settings } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", ["evolution_api_url", "evolution_api_key"]);

        const apiUrl = settings?.find(s => s.key === "evolution_api_url")?.value;
        const apiKey = settings?.find(s => s.key === "evolution_api_key")?.value;

        if (apiUrl && apiKey) {
          await fetch(`${apiUrl}/message/sendText/iatende`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": apiKey,
            },
            body: JSON.stringify({
              number: phoneNumber,
              text: matchedResponse.response_text,
            }),
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, conversationId: conversation.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
