import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { useAuth } from "../context/AuthContext";
import logo from "../../public/logo.png";
import "../styles/LoginPage.css";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const leftPanelRef = useRef(null);
  const cardRef = useRef(null);
  const welcomeRef = useRef(null);
  const welcomeCopyRef = useRef(null);
  const submitButtonRef = useRef(null);
  const [form, setForm] = useState({ email: "", password: "", remember: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return undefined;

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      timeline
        .fromTo(leftPanelRef.current, { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.72 })
        .fromTo(welcomeRef.current, { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.72 }, "<")
        .fromTo(".login-card", { opacity: 0, y: 22, scale: 0.975 }, { opacity: 1, y: 0, scale: 1, duration: 0.5 }, "-=0.36")
        .fromTo(".login-logo", { opacity: 0, y: -14, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.45)" }, "-=0.18")
        .fromTo(".login-brand h1", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.38 }, "-=0.22")
        .fromTo(
          ".login-field",
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.56,
            ease: "back.out(1.35)",
            stagger: 0.12,
            clearProps: "opacity,transform",
          },
          "-=0.12"
        )
        .fromTo(".welcome-copy h2", { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.2)" }, "-=0.72")
        .fromTo(".welcome-copy p", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.42 }, "-=0.28")
        .fromTo(".shape-circle", { opacity: 0, scale: 0.82 }, { opacity: 0.45, scale: 1, duration: 0.5, stagger: 0.1 }, "-=0.7");

      gsap.to(".shape-circle.one", { y: -18, duration: 3.4, ease: "sine.inOut", repeat: -1, yoyo: true });
      gsap.to(".shape-circle.two", { y: 16, duration: 3.9, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 0.25 });
      gsap.to(".shape-circle.three", { y: -22, duration: 4.4, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 0.45 });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!error || prefersReducedMotion() || !cardRef.current) return;

    const inputs = cardRef.current.querySelectorAll(".input-icon input");
    const timeline = gsap.timeline();

    timeline
      .to(cardRef.current, { x: -8, duration: 0.055, ease: "power1.inOut" })
      .to(cardRef.current, { x: 8, duration: 0.055, ease: "power1.inOut" })
      .to(cardRef.current, { x: -6, duration: 0.055, ease: "power1.inOut" })
      .to(cardRef.current, { x: 6, duration: 0.055, ease: "power1.inOut" })
      .to(cardRef.current, { x: 0, duration: 0.08, clearProps: "x" })
      .fromTo(
        inputs,
        { borderColor: "var(--danger)" },
        { borderColor: "var(--line)", duration: 1.05, ease: "power2.out", clearProps: "borderColor" },
        0
      );
  }, [error]);

  const playSubmitAnimation = (variant = "loading") => {
    if (prefersReducedMotion() || !submitButtonRef.current) return Promise.resolve();

    const button = submitButtonRef.current;
    const color = variant === "success" ? "var(--success)" : variant === "error" ? "var(--danger)" : "var(--accent)";

    return new Promise((resolve) => {
      gsap
        .timeline({ onComplete: resolve })
        .to(button, { scale: 0.97, duration: 0.08, ease: "power2.out" })
        .to(button, { scale: 1.03, duration: 0.12, ease: "back.out(2)" })
        .to(button, { scale: 1, background: color, duration: 0.18, ease: "power2.out" })
        .to(button, { background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", duration: 0.28, delay: 0.06, clearProps: "background,scale" });
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.email.trim() || !form.password.trim()) {
      setError("Vui lòng nhập email và mật khẩu.");
      await playSubmitAnimation("error");
      return;
    }

    setLoading(true);
    await playSubmitAnimation("loading");

    try {
      await login(form.email, form.password);
      await playSubmitAnimation("success");
      navigate("/");
    } catch (err) {
      if (!err.response) {
        setError("Không kết nối được backend. Hãy chạy backend ở cổng 4000.");
      } else {
        setError(err.response?.data?.message || "Đăng nhập thất bại");
      }
      await playSubmitAnimation("error");
    } finally {
      setLoading(false);
    }
  };

  const handleWelcomePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const offsetX = (x - 50) / 50;
    const offsetY = (y - 50) / 50;
    event.currentTarget.style.setProperty("--press-x", `${x}%`);
    event.currentTarget.style.setProperty("--press-y", `${y}%`);

    if (!prefersReducedMotion()) {
      gsap.to(welcomeCopyRef.current, { x: offsetX * 10, y: offsetY * 6, duration: 0.45, ease: "power3.out" });
      gsap.to(".shape-circle.one", { x: offsetX * -18, duration: 0.55, ease: "power3.out" });
      gsap.to(".shape-circle.two", { x: offsetX * 14, duration: 0.55, ease: "power3.out" });
      gsap.to(".shape-circle.three", { x: offsetX * -24, duration: 0.55, ease: "power3.out" });
    }
  };

  const handleWelcomePointerLeave = (event) => {
    event.currentTarget.style.setProperty("--press-x", "50%");
    event.currentTarget.style.setProperty("--press-y", "50%");

    if (!prefersReducedMotion()) {
      gsap.to(welcomeCopyRef.current, { x: 0, y: 0, duration: 0.45, ease: "power3.out" });
      gsap.to(".shape-circle", { x: 0, duration: 0.55, ease: "power3.out" });
    }
  };

  const handleInputFocus = (event) => {
    if (prefersReducedMotion()) return;
    gsap.to(event.currentTarget, {
      scale: 1.012,
      boxShadow: "0 10px 24px rgba(15, 76, 129, 0.12)",
      duration: 0.22,
      ease: "power2.out",
    });
  };

  const handleInputBlur = (event) => {
    if (prefersReducedMotion()) return;
    gsap.to(event.currentTarget, {
      scale: 1,
      boxShadow: "0 0 0 rgba(15, 76, 129, 0)",
      duration: 0.22,
      ease: "power2.out",
      clearProps: "scale,boxShadow",
    });
  };

  const handleButtonHover = (isHovering) => {
    if (prefersReducedMotion() || !submitButtonRef.current || loading) return;
    gsap.to(submitButtonRef.current, {
      y: isHovering ? -2 : 0,
      scale: isHovering ? 1.015 : 1,
      duration: 0.22,
      ease: "power2.out",
      clearProps: isHovering ? "" : "transform",
    });
  };

  return (
    <div className="login-page" ref={pageRef}>
      <div className="login-panel" ref={leftPanelRef}>
        <div className="login-card" ref={cardRef}>
          <div className="login-brand">
            <img className="login-logo" src={logo} alt="Logo" />
            <h1>Đăng nhập</h1>
          </div>

          <form onSubmit={onSubmit} noValidate>
            <div className="input-group login-field">
              <label className="input-label" htmlFor="email">
                Email hoặc mã người dùng
              </label>
              <div className="input-icon" onFocus={handleInputFocus} onBlur={handleInputBlur}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6.5C4 5.11929 5.11929 4 6.5 4H17.5C18.8807 4 20 5.11929 20 6.5V17.5C20 18.8807 18.8807 20 17.5 20H6.5C5.11929 20 4 18.8807 4 17.5V6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 7.75L12 13.5L20 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Nhập email hoặc mã người dùng"
                />
              </div>
            </div>

            <div className="input-group login-field">
              <label className="input-label" htmlFor="password">
                Mật khẩu
              </label>
              <div className="input-icon" onFocus={handleInputFocus} onBlur={handleInputBlur}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 10V8C17 5.23858 14.7614 3 12 3C9.23858 3 7 5.23858 7 8V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="6" y="10" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 15V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Nhập mật khẩu"
                />
              </div>
            </div>

            {error ? <p className="error-text" role="alert">{error}</p> : null}

            <div className="login-meta login-field">
              <label>
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                />
                Ghi nhớ tôi
              </label>
              <Link to="/forgot-password" className="forgot-link">
                Quên mật khẩu?
              </Link>
            </div>

            <button
              className="login-button login-field"
              type="submit"
              disabled={loading}
              ref={submitButtonRef}
              onMouseEnter={() => handleButtonHover(true)}
              onMouseLeave={() => handleButtonHover(false)}
            >
              {loading ? "Đang xử lý..." : "ĐĂNG NHẬP"}
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                <path d="M5 12H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M13 6L19 12L13 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <p className="login-note login-field">
              Tài khoản mẫu: admin@iuh.edu.vn, canbo1@iuh.edu.vn, hoidong@iuh.edu.vn, gv@iuh.edu.vn, sv@iuh.edu.vn - mật khẩu: 123456
            </p>
          </form>
        </div>
      </div>

      <div
        className="welcome-panel"
        ref={welcomeRef}
        onMouseMove={handleWelcomePointerMove}
        onMouseLeave={handleWelcomePointerLeave}
      >
        <div className="welcome-copy" ref={welcomeCopyRef}>
          <h2>CHÀO MỪNG!</h2>
          <p>Hành trình vinh danh bắt đầu từ đây</p>
        </div>
        <div className="shape-circle one"></div>
        <div className="shape-circle two"></div>
        <div className="shape-circle three"></div>
      </div>
    </div>
  );
}
