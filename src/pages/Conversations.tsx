import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Send, Search, Paperclip, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  customer_name: string;
  status: string;
  last_message_at: string;
  channel: string;
}

interface Message {
  id: string;
  content: string;
  sender_type: string;
  created_at: string;
  sender_id?: string;
  message_type?: string;
  file_url?: string | null;
  profiles?: {
    full_name: string;
  };
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userId, setUserId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.id);
      
      const channel = supabase
        .channel(`messages:${selectedConv.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${selectedConv.id}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConv]);

  const fetchConversations = async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar as conversas",
        variant: "destructive",
      });
    } else {
      setConversations(data || []);
    }
  };

  const fetchMessages = async (convId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*, profiles(full_name)")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    if (!error) {
      setMessages(data || []);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConv) return;

    try {
      const { error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          conversationId: selectedConv.id,
          content: newMessage,
          messageType: "text",
        },
      });

      if (error) throw error;
      
      setNewMessage("");
      toast({
        title: "Enviado",
        description: "Mensagem enviada com sucesso",
      });
    } catch (error) {
      console.error("Erro ao enviar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConv) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data, error } = await supabase.functions.invoke("upload-whatsapp-media", {
        body: formData,
      });

      if (error) throw error;

      const messageType = file.type.startsWith("image/") ? "image" : "document";
      
      await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          conversationId: selectedConv.id,
          content: file.name,
          messageType,
          fileUrl: `data:${file.type};base64,${data.file.data}`,
        },
      });

      toast({
        title: "Enviado",
        description: "Arquivo enviado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao enviar arquivo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o arquivo",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-success",
      pending: "bg-warning",
      resolved: "bg-primary",
      closed: "bg-muted",
    };
    return colors[status] || "bg-muted";
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-8rem)] flex gap-4">
        {/* Lista de conversas */}
        <Card className="w-80 p-4 flex flex-col">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar conversas..." className="pl-9" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedConv?.id === conv.id
                    ? "bg-primary/10 border-l-4 border-primary"
                    : "hover:bg-muted"
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-semibold">{conv.customer_name}</span>
                  <Badge className={`${getStatusColor(conv.status)} text-white`}>
                    {conv.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {conv.channel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.last_message_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Área de mensagens */}
        <Card className="flex-1 flex flex-col">
          {selectedConv ? (
            <>
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {selectedConv.customer_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{selectedConv.customer_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedConv.channel}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_type === "agent" ? "justify-end" : "justify-start"
                    }`}
                  >
                     <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.sender_type === "agent"
                          ? "bg-primary text-primary-foreground"
                          : msg.sender_type === "bot"
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {msg.message_type === "image" && msg.file_url && (
                        <img src={msg.file_url} alt="Imagem" className="max-w-full rounded mb-2" />
                      )}
                      {msg.message_type === "document" && msg.file_url && (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mb-2 underline">
                          <Paperclip className="h-4 w-4" />
                          Abrir documento
                        </a>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {formatDistanceToNow(new Date(msg.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,application/pdf,.doc,.docx"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Digite sua mensagem... (emojis suportados 😊)"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Selecione uma conversa para começar
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
