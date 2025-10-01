import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Agent {
  id: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    
    setAgents(data || []);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      online: "bg-success text-success-foreground",
      offline: "bg-muted text-muted-foreground",
      away: "bg-warning text-warning-foreground",
      busy: "bg-destructive text-destructive-foreground",
    };
    return colors[status] || "bg-muted";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Atendentes</h1>
          <p className="text-muted-foreground">Gerencie sua equipe de atendimento</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-lg">
                      {agent.full_name?.substring(0, 2).toUpperCase() || "AG"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {agent.full_name || "Sem nome"}
                    </h3>
                    <p className="text-sm text-muted-foreground capitalize">{agent.role}</p>
                    <Badge className={`mt-2 ${getStatusColor(agent.status)}`}>
                      {agent.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {agents.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum atendente encontrado.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
