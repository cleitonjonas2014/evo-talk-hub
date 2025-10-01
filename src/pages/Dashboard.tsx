import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Ticket, Users, TrendingUp } from "lucide-react";

interface Stats {
  totalConversations: number;
  openTickets: number;
  activeAgents: number;
  avgResponseTime: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalConversations: 0,
    openTickets: 0,
    activeAgents: 0,
    avgResponseTime: "0min",
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [conversations, tickets, agents] = await Promise.all([
        supabase.from("conversations").select("*", { count: "exact", head: true }),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "online"),
      ]);

      setStats({
        totalConversations: conversations.count || 0,
        openTickets: tickets.count || 0,
        activeAgents: agents.count || 0,
        avgResponseTime: "2min",
      });
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Total de Conversas",
      value: stats.totalConversations,
      icon: MessageSquare,
      bgColor: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "Tickets Abertos",
      value: stats.openTickets,
      icon: Ticket,
      bgColor: "bg-warning/10",
      iconColor: "text-warning",
    },
    {
      title: "Atendentes Online",
      value: stats.activeAgents,
      icon: Users,
      bgColor: "bg-success/10",
      iconColor: "text-success",
    },
    {
      title: "Tempo Médio de Resposta",
      value: stats.avgResponseTime,
      icon: TrendingUp,
      bgColor: "bg-accent/10",
      iconColor: "text-accent",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu centro de atendimento</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Conversas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nenhuma conversa recente. Inicie um atendimento para visualizar aqui.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Métricas de Desempenho</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Taxa de Resolução</span>
                  <span className="text-sm font-bold text-success">85%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Satisfação do Cliente</span>
                  <span className="text-sm font-bold text-success">4.5/5</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Tickets Resolvidos Hoje</span>
                  <span className="text-sm font-bold">12</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
