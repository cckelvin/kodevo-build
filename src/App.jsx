import { useState } from "react";

function App() {
  const [provider, setProvider] = useState("Groq");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  const newProject = () => {
    setMessages([]);
    setMessage("");
  };

  const sendMessage = () => {
    if (!message.trim()) return;

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: message.trim()
      }
    ]);

    setMessage("");
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">K</div>
          <span>Kodevo</span>
        </div>

        <button className="new-project" onClick={newProject}>
          <span>+</span>
          New project
        </button>

        <div className="sidebar-section">
          <div className="section-title">Projects</div>

          <div className="project active">
            <span className="project-icon">⌁</span>
            Untitled project
          </div>
        </div>

        <div className="sidebar-bottom">
          <button
            className="sidebar-button"
            onClick={() => setShowSettings(!showSettings)}
          >
            <span>⚙</span>
            Settings
          </button>
        </div>
      </aside>

      {/* Main */}
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
              onClick={() => setShowSettings(!showSettings)}
            >
              Settings
            </button>
          </div>
        </header>

        {/* Chat */}
        <section className="workspace">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-logo">K</div>

              <h1>Build with Kodevo</h1>

              <p>
                Describe what you want to build and Kodevo will help
                you create it.
              </p>

              <div className="suggestions">
                <button
                  onClick={() =>
                    setMessage("Build me a modern landing page")
                  }
                >
                  Build a website
                </button>

                <button
                  onClick={() =>
                    setMessage("Create a React application")
                  }
                >
                  Create an app
                </button>

                <button
                  onClick={() =>
                    setMessage("Fix the errors in my project")
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
                    {item.role === "user" ? "You" : "Kodevo"}
                  </div>

                  <div className="message-content">
                    {item.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Composer */}
        <div className="composer-area">
          <div className="composer">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Describe what you want Kodevo to build..."
            />

            <div className="composer-bottom">
              <div className="composer-tools">
                <button title="Attach files">+</button>
                <button title="Code mode">&lt;/&gt;</button>
              </div>

              <button
                className="send-button"
                onClick={sendMessage}
                disabled={!message.trim()}
              >
                ↑
              </button>
            </div>
          </div>

          <div className="disclaimer">
            Kodevo can make mistakes. Review generated code before using it.
          </div>
        </div>
      </main>

      {/* Settings */}
      {showSettings && (
        <aside className="settings-panel">
          <div className="settings-header">
            <h2>AI Provider</h2>

            <button
              onClick={() => setShowSettings(false)}
              className="close-button"
            >
              ×
            </button>
          </div>

          <label>Provider</label>

          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            <option>Groq</option>
            <option>OpenRouter</option>
            <option>Gemini</option>
          </select>

          <label>Model ID</label>

          <input
            type="text"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="Enter model ID"
          />

          <label>API Key</label>

          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Enter API key"
          />

          <button className="save-button">
            Save configuration
          </button>

          <div className="settings-note">
            Your API configuration will be used by Kodevo when
            the AI provider integration is connected.
          </div>
        </aside>
      )}
    </div>
  );
}

export default App;