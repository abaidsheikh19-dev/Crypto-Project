import { redirect } from 'next/navigation';

// The catalog moved to the home page; keep old links working.
export default function CatalogRedirect() {
  redirect('/');
}
