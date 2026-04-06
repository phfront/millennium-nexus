"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Card, Alert, useToast } from "@phfront/millennium-ui";
import { Download, Check } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    nav.standalone === true
  );
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function PwaInstallCard() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setMounted(true);
    setStandalone(isStandaloneMode());
    setIsIOS(detectIOS());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => setStandalone(isStandaloneMode());
    mq.addEventListener("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      mq.removeEventListener("change", onDisplayChange);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const ev = deferredRef.current;
    if (!ev) return;
    setInstalling(true);
    try {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      deferredRef.current = null;
      setCanInstall(false);
      if (outcome === "accepted") {
        toast.success("Instalação iniciada", "Siga as instruções do sistema.");
      }
    } catch {
      toast.error("Não foi possível abrir o instalador");
    } finally {
      setInstalling(false);
    }
  }, [toast]);

  if (!mounted) {
    return null;
  }

  if (standalone) {
    return (
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-text-primary">
            Aplicativo
          </h2>
        </Card.Header>
        <Card.Body className="flex items-start gap-3">
          <Check
            size={20}
            className="text-success shrink-0 mt-0.5"
            aria-hidden
          />
          <p className="text-sm text-text-secondary">
            O Millennium Nexus está aberto como PWA (modo standalone).
          </p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-text-primary">
          Instalar aplicativo
        </h2>
      </Card.Header>
      <Card.Body className="space-y-3">
        {isIOS ? (
          <Alert variant="info">
            No iPhone/iPad: toque em{" "}
            <strong className="font-semibold">Compartilhar</strong> (□↑) e
            depois em{" "}
            <strong className="font-semibold">
              Adicionar à Tela de Início
            </strong>
            .
          </Alert>
        ) : (
          <>
            <p className="text-xs text-text-muted leading-relaxed">
              <strong className="text-text-secondary">Atalho</strong>{" "}
              ("Adicionar à tela inicial") abre o site dentro do Chrome.{" "}
              <strong className="text-text-secondary">Instalar app</strong> abre
              em modo PWA (sem barra de endereço).
            </p>
          </>
        )}
      </Card.Body>
      <Card.Footer className="justify-end">
        {canInstall ? (
          <Button
            leftIcon={<Download size={16} />}
            onClick={handleInstall}
            isLoading={installing}
          >
            Instalar app
          </Button>
        ) : (
          <p className="text-xs text-text-muted">
            Se não aparecer o botão, no menu ⋮ procure{" "}
            <strong className="text-text-secondary">Instalar app</strong>.
          </p>
        )}
      </Card.Footer>
    </Card>
  );
}
