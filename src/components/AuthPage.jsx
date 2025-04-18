import { useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

const AuthPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSessionAndRedirect = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (data?.session) {
        console.log("✅ Session exists, redirecting to /admin");
        navigate("/admin");
      }

      // Also listen to future auth changes (like SSO return)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) {
          console.log("✅ SIGNED_IN via listener, redirecting to /admin");
          navigate("/admin");
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    };

    checkSessionAndRedirect();
  }, [navigate]);

  return (
    <div
      style={{
        backgroundColor: "#f1f1f1",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "2.5rem",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.1)",
          textAlign: "center",
        }}
      >
        <img
          src="/Tatt2Away-Color-Black-Logo-300.png"
          alt="Tatt2Away Logo"
          style={{
            width: "120px",
            height: "auto",
            marginBottom: "1.5rem",
          }}
        />

        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={["apple", "google"]}
          redirectTo="http://localhost:3000/admin"
          theme="light"
          view="sign_in"
          showLinks={true}
          magicLink={false}
          onlyThirdPartyProviders={false}
          layout="vertical"
          socialLayout="horizontal"
        />
      </div>
    </div>
  );
};

export default AuthPage;
