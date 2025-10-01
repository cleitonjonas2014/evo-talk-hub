import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palette } from "lucide-react";

export default function Settings() {
  const [settings, setSettings] = useState({
    evolution_api_url: "",
    evolution_api_key: "",
    bot_enabled: true,
    bot_greeting: "",
  });
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("settings").select("*");
    
    if (data) {
      const settingsObj: any = {};
      data.forEach((setting) => {
        if (setting.key === "bot_enabled") {
          settingsObj[setting.key] = setting.value === "true";
        } else {
          settingsObj[setting.key] = setting.value;
        }
      });
      setSettings(settingsObj);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from("settings")
      .update({ value })
      .eq("key", key);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a configuração",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Configuração atualizada!",
      });
    }
  };

  const handleSave = async () => {
    await updateSetting("evolution_api_url", settings.evolution_api_url);
    await updateSetting("evolution_api_key", settings.evolution_api_key);
    await updateSetting("bot_enabled", settings.bot_enabled.toString());
    await updateSetting("bot_greeting", settings.bot_greeting);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Configure as integrações e personalize seu sistema
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              <CardTitle>Tema</CardTitle>
            </div>
            <CardDescription>
              Escolha o tema de cores do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="theme">Tema de Cores</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger id="theme">
                  <SelectValue placeholder="Selecione um tema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">☀️ Claro</SelectItem>
                  <SelectItem value="dark">🌙 Escuro</SelectItem>
                  <SelectItem value="theme-blue">💙 Azul</SelectItem>
                  <SelectItem value="theme-red">❤️ Vermelho</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integração Evolution API (WhatsApp)</CardTitle>
            <CardDescription>
              Configure a conexão com a Evolution API para integrar o WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-url">URL da API</Label>
              <Input
                id="api-url"
                placeholder="https://api.example.com"
                value={settings.evolution_api_url}
                onChange={(e) =>
                  setSettings({ ...settings, evolution_api_url: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Sua chave de API"
                value={settings.evolution_api_key}
                onChange={(e) =>
                  setSettings({ ...settings, evolution_api_key: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chatbot com IA</CardTitle>
            <CardDescription>
              Configure o comportamento do chatbot inteligente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar Chatbot</Label>
                <p className="text-sm text-muted-foreground">
                  Permite respostas automáticas com IA
                </p>
              </div>
              <Switch
                checked={settings.bot_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, bot_enabled: checked })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bot-greeting">Mensagem de Saudação</Label>
              <Textarea
                id="bot-greeting"
                placeholder="Olá! Como posso ajudar você hoje?"
                value={settings.bot_greeting}
                onChange={(e) =>
                  setSettings({ ...settings, bot_greeting: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full">
          Salvar Configurações
        </Button>
      </div>
    </Layout>
  );
}
