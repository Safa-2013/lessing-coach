-- Optional production backend schema for shared admin/contact/request data.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  class_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.term_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text unique not null,
  first_name text not null,
  last_name text not null,
  class_name text not null,
  area text not null,
  desired_date date not null,
  status text not null default 'eingegangen',
  created_at timestamptz not null default now()
);
create table if not exists public.ai_errors (
  id uuid primary key default gen_random_uuid(),
  question text,
  error text not null,
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_at_idx on public.contact_messages(created_at desc);
create index if not exists term_requests_code_idx on public.term_requests(request_code);
create index if not exists ai_errors_created_at_idx on public.ai_errors(created_at desc);
