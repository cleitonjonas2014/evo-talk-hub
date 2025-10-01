import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
}

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    
    setTickets(data || []);
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: "bg-destructive text-destructive-foreground",
      high: "bg-warning text-warning-foreground",
      normal: "bg-primary text-primary-foreground",
      low: "bg-muted text-muted-foreground",
    };
    return colors[priority] || "bg-muted";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-success text-success-foreground",
      in_progress: "bg-warning text-warning-foreground",
      resolved: "bg-primary text-primary-foreground",
      closed: "bg-muted text-muted-foreground",
    };
    return colors[status] || "bg-muted";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Tickets</h1>
            <p className="text-muted-foreground">Gerencie todos os tickets de suporte</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Ticket
          </Button>
        </div>

        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg">{ticket.title}</CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {ticket.description}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Badge className={getPriorityColor(ticket.priority)}>
                      {ticket.priority}
                    </Badge>
                    <Badge className={getStatusColor(ticket.status)}>
                      {ticket.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Categoria: {ticket.category || "Sem categoria"}</span>
                  <span>
                    {formatDistanceToNow(new Date(ticket.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}

          {tickets.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum ticket encontrado. Crie um novo ticket para começar.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
