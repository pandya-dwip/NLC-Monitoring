import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { Moon, Sun } from 'lucide-react';

function getInitialDark(): boolean {
  if (document.documentElement.classList.contains('dark')) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(getInitialDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <Button variant="ghost" size="sm" isIconOnly onPress={() => setDark((d) => !d)} aria-label="Toggle theme">
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </Button>
  );
}
