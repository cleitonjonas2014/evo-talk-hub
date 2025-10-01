-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'manager')),
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away', 'busy')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  assigned_agent_id UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  channel TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'web', 'phone')),
  tags TEXT[],
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'bot')),
  sender_id UUID REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'audio', 'video')),
  file_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tickets table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES public.conversations(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_agent_id UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bot_responses table for AI chatbot
CREATE TABLE public.bot_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword TEXT NOT NULL,
  response_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  category TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create settings table for Evolution API integration
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Conversations policies
CREATE POLICY "Agents can view all conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents can update conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (true);

-- Messages policies
CREATE POLICY "Agents can view all messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents can create messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents can update own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid() OR sender_type = 'bot');

-- Tickets policies
CREATE POLICY "Agents can view all tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents can create tickets"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents can update tickets"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (true);

-- Bot responses policies
CREATE POLICY "Agents can view bot responses"
  ON public.bot_responses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents can manage bot responses"
  ON public.bot_responses FOR ALL
  TO authenticated
  USING (true);

-- Settings policies
CREATE POLICY "Agents can view settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify settings"
  ON public.settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_bot_responses_updated_at
  BEFORE UPDATE ON public.bot_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'agent'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Insert some default settings
INSERT INTO public.settings (key, value, description) VALUES
  ('evolution_api_url', '', 'Evolution API base URL'),
  ('evolution_api_key', '', 'Evolution API authentication key'),
  ('bot_enabled', 'true', 'Enable/disable AI chatbot'),
  ('bot_greeting', 'Olá! Como posso ajudar você hoje?', 'Default bot greeting message');

-- Insert sample bot responses
INSERT INTO public.bot_responses (keyword, response_text, category, is_active) VALUES
  ('oi', 'Olá! Como posso ajudá-lo?', 'saudação', true),
  ('horário', 'Nosso horário de atendimento é de segunda a sexta, das 9h às 18h.', 'informação', true),
  ('preço', 'Para informações sobre preços, por favor entre em contato com nossa equipe comercial.', 'comercial', true),
  ('obrigado', 'Por nada! Estou aqui para ajudar!', 'saudação', true)