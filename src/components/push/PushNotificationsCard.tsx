"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Card, Alert, useToast } from "@phfront/millennium-ui";
import { Bell, BellOff, Send } from "lucide-react";
import {
  urlBase64ToUint8Array,
  isPushSupported,
  isSecureContextForPush,
} from "@/lib/push/client";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function PushNotificationsCard() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshSubscriptionState = useCallback(async () => {
    if (!isPushSupported() || !VAPID_PUBLIC) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      setSubscribed(false);
      return;
    }
    const sub = await reg.pushManager.getSubscription();
    setSubscribed(!!sub);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void refreshSubscriptionState();
  }, [mounted, refreshSubscriptionState]);

  async function registerAndSubscribe() {
    if (!VAPID_PUBLIC) {
      toast.error(
        "VAPID não configurado",
        "Execute npm run generate-vapid e copie as chaves para o .env.local"
      );
      return;
    }
    if (!isSecureContextForPush()) {
      toast.error(
        "HTTPS necessário",
        "No celular use um túnel (ngrok) ou deploy com HTTPS. localhost no PC funciona."
      );
      return;
    }

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await reg.update();
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.warning(
          "Permissão negada",
          "Ative as notificações nas configurações do navegador."
        );
        return;
      }

      let sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }

      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : res.statusText);
      }

      setSubscribed(true);
      toast.success("Notificações ativadas!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao ativar", msg);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) {
        setSubscribed(false);
        return;
      }

      const endpoint = sub.endpoint;
      const res = await fetch("/api/push/subscribe", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : res.statusText);
      }

      await sub.unsubscribe();
      setSubscribed(false);
      toast.info("Notificações desativadas");
    } catch (e) {
      toast.error("Erro", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        credentials: "include",
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : res.statusText);
      }
      toast.success(
        "Enviado",
        "Verifique a bandeja de notificações do sistema."
      );
    } catch (e) {
      toast.error("Falha no teste", e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }

  if (!mounted) {
    return null;
  }

  if (!isPushSupported()) {
    return (
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-text-primary">
            Notificações push
          </h2>
        </Card.Header>
        <Card.Body>
          <p className="text-xs text-text-muted">
            Este navegador não suporta Web Push.
          </p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-text-primary">
          Notificações push
        </h2>
      </Card.Header>
      <Card.Body className="space-y-3">
        <p className="text-xs text-text-muted leading-relaxed">
          No celular use HTTPS (ex.: ngrok). No iOS 16.4+, instale o PWA na tela
          inicial para receber push.
        </p>
        {!VAPID_PUBLIC && (
          <Alert variant="warning">
            Execute{" "}
            <code className="text-xs font-mono">npm run generate-vapid</code> e
            copie as chaves para o{" "}
            <code className="text-xs font-mono">.env.local</code>
          </Alert>
        )}
      </Card.Body>
      <Card.Footer className="justify-end">
        {!subscribed ? (
          <Button
            leftIcon={<Bell size={16} />}
            onClick={registerAndSubscribe}
            isLoading={loading}
          >
            Ativar notificações
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              leftIcon={<Send size={16} />}
              onClick={sendTest}
              isLoading={testing}
            >
              Enviar teste
            </Button>
            <Button
              variant="ghost"
              leftIcon={<BellOff size={16} />}
              onClick={unsubscribe}
              isLoading={loading}
            >
              Desativar
            </Button>
          </>
        )}
      </Card.Footer>
    </Card>
  );
}
