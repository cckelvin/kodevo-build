import { useEffect, useState } from "react";

const DEFAULT_MODELS = {
  Groq: "llama-3.3-70b-versatile",
  OpenRouter: "openai/gpt-4o-mini",
  Gemini: "gemini-2.0-flash"
};

function App() {
  const [provider, setProvider] = useState("Groq");
  const [model, setModel] = useState(DEFAULT_MODELS.Groq);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("kodevo-config");

    if (saved) {
      try {
        const config = JSON.parse(saved);

        setProvider(config.provider || "Groq");
        setModel(
          config.model ||
            DEFAULT_MODELS[config.provider || "Groq"]
        );
        setApiKey(config.apiKey || "");
      } catch {
        console.log("Could not load saved configuration.");
      }
    }
  }, []);

  const saveConfiguration = () => {
    localStorage.setItem(
      "kodevo-config",
      JSON.stringify({
        provider,
        model,
        apiKey
      })
    );

    alert("Configuration saved.");
  };

  const newProject = () => {
    setMessages([]);
    setMessage("");
  };

  const callAI = async (userMessage, previousMessages) => {
    if (!apiKey.trim()) {
      throw new Error("Please enter your API key in Settings.");
    }

    const conversation = [
      {
        role: "system",
        content:
          "You are Kodevo, an AI coding assistant. Help the user build websites, applications, and software. Give practical, accurate code and explanations."
      },
      ...previousMessages
        .filter(
          (item) =>
            item.role === "user" ||
            item.role === "assistant"
        )
        .map((item) => ({
          role: item.role,
          content: item.content
        })),
      {
        role: "user",
        content: userMessage
      }
    ];

    let response;

    if (provider === "Gemini") {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: conversation
              .filter((item) => item.role !== "system")
              .map((item) => ({
                role:
                  item.role === "assistant"
                    ? "model"
                    : "user",
                parts: [{ text: item.content }]
              })),
            systemInstruction: {
              parts: [
                {
                  text:
                    "You are Kodevo, an AI coding assistant. Help the user build websites, applications, and software."
                }
              ]
            }
          })
        }
      );
    } else {
      const endpoint =
        provider === "OpenRouter"
          ? "https://openrouter.ai/api/v1/chat/completions"
          : "https://api.groq.com/openai/v1/chat/completions";

      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: conversation,
          temperature: 0.7
        })
      });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          data?.message ||
          `API request failed (${response.status})`
      );
    }

    if (provider === "Gemini") {
      return (
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "The AI returned an empty response."
      );
    }

    return (
      data?.choices?.[0]?.message?.content ||
      "The AI returned an empty response."
    );
  };

  const sendMessage = async () => {
    const text = message.trim();

    if (!text || loading) return;

    const userMessage = {
      role: "user",
      content: text
    };

    const previousMessages = messages;

    setMessages((current) => [
      ...current,
      userMessage
    ]);

    setMessage("");
    setLoading(true);

    try {
      const answer = await callAI(
        text,
        previousMessages
      );

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: answer
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Error: ${error.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (event) => {
    const newProvider = event.target.value;

    setProvider(newProvider);
    setModel(
      DEFAULT_MODELS[newProvider] || ""
    );
  };

  return (
    <div className="app">

      <aside className="sidebar">

        <div className="brand">
          <div className="logo">K</div>
          <span>Kodevo</span>
        </div>

        <button
          className="new-project"
          onClick={newProject}
        >
          <span>+</span>
          New project
        </button>

        <div className="sidebar-section">

          <div className="section-title">
            Projects
          </div>

          <div className="project active">
            <span className="project-icon">
              ⌁
            </span>
            Untitled project
          </div>

        </div>

        <div className="sidebar-bottom">

          <button
            className="sidebar-button"
            onClick={() =>
              setShowSettings(!showSettings)
            }
          >
            <span>⚙</span>
            Settings
          </button>

        </div>

      </aside>

      <main className="main">

        <header className="topbar">

          <div className="project-name">
            Untitled project
          </div>

          <div className="top-actions">

            <div className="provider-badge">
              {provider}
              {model ? ` · ${model}` : ""}
            </div>

            <button
              className="settings-button"
              onClick={() =>
                setShowSettings(!showSettings)
              }
            >
              Settings
            </button>

          </div>

        </header>

        <section className="workspace">

          {messages.length === 0 ? (

            <div className="welcome">

              <div className="welcome-logo">
                K
              </div>

              <h1>
                Build with Kodevo
              </h1>

              <p>
                Describe what you want to build
                and Kodevo will help you create it.
              </p>

              <div className="suggestions">

                <button
                  onClick={() =>
                    setMessage(
                      "Build me a modern landing page"
                    )
                  }
                >
                  Build a website
                </button>

                <button
                  onClick={() =>
                    setMessage(
                      "Create a React application"
                    )
                  }
                >
                  Create an app
                </button>

                <button
                  onClick={() =>
                    setMessage(
                      "Fix the errors in my project"
                    )
                  }
                >
                  Fix my code
                </button>

              </div>

            </div>

          ) : (

            <div className="conversation">

              {messages.map((item, index) => (

                <div
                  className={`message ${item.role}`}
                  key={index}
                >

                  <div className="message-label">
                    {item.role === "user"
                      ? "You"
                      : "Kodevo"}
                  </div>

                  <div className="message-content">
                    {item.content}
                  </div>

                </div>

              ))}

              {loading && (

                <div className="message assistant">

                  <div className="message-label">
                    Kodevo
                  </div>

                  <div className="message-content">
                    Thinking...
                  </div>

                </div>

              )}

            </div>

          )}

        </section>

        <div className="composer-area">

          <div className="composer">

            <textarea
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              onKeyDown={(event) => {

                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  sendMessage();
                }

              }}
              placeholder="Describe what you want Kodevo to build..."
            />

            <div className="composer-bottom">

              <div className="composer-tools">

                <button title="Attach files">
                  +
                </button>

                <button title="Code mode">
                  &lt;/&gt;
                </button>

              </div>

              <button
                className="send-button"
                onClick={sendMessage}
                disabled={
                  !message.trim() ||
                  loading
                }
              >
                ↑
              </button>

            </div>

          </div>

          <div className="disclaimer">
            Kodevo can make mistakes. Review
            generated code before using it.
          </div>

        </div>

      </main>

      {showSettings && (

        <aside className="settings-panel">

          <div className="settings-header">

            <h2>
              AI Provider
            </h2>

            <button
              onClick={() =>
                setShowSettings(false)
              }
              className="close-button"
            >
              ×
            </button>

          </div>

          <label>
            Provider
          </label>

          <select
            value={provider}
            onChange={handleProviderChange}
          >
            <option>
              Groq
            </option>

            <option>
              OpenRouter
            </option>

            <option>
              Gemini
            </option>
          </select>

          <label>
            Model ID
          </label>

          <input
            type="text"
            value={model}
            onChange={(event) =>
              setModel(event.target.value)
            }
            placeholder="Enter model ID"
          />

          <label>
            API Key
          </label>

          <input
            type="password"
            value={apiKey}
            onChange={(event) =>
              setApiKey(event.target.value)
            }
            placeholder="Enter API key"
          />

          <button
            className="save-button"
            onClick={saveConfiguration}
          >
            Save configuration
          </button>

          <div className="settings-note">
            Configuration is stored locally in
            this browser.
          </div>

        </aside>

      )}

    </div>
  );
}

export default App;