import { useEffect, useMemo, useState } from "react";

const DEFAULT_MODELS = {
  groq: "llama-3.3-70b-versatile",
  openrouter: "openai/gpt-4o-mini",
  gemini: "gemini-2.0-flash",
};

const CONNECTOR_INFO = {
  GitHub: {
    description: "Repositories, files, commits and code",
    icon: "◉",
  },
  Supabase: {
    description: "Database, authentication and backend services",
    icon: "◆",
  },
  Airtable: {
    description: "Tables, records and structured data",
    icon: "▦",
  },
  Dropbox: {
    description: "Files and folders",
    icon: "□",
  },
  Vercel: {
    description: "Deployments, projects and hosting",
    icon: "▲",
  },
};

const INITIAL_PROJECT = {
  name: "",
  purpose: "",
  targetUsers: "",
  platform: "web",
  design: {
    theme: "",
    colors: [],
    style: "",
    layout: "",
    references: [],
  },
  features: [],
  pages: [],
  technical: {
    framework: "",
    database: "",
    authentication: "",
    payments: "",
  },
  integrations: [],
  requirements: [],
  decisions: [],
  files: [],
};

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [provider, setProvider] = useState(
    () => localStorage.getItem("kodevo-provider") || "groq"
  );

  const [model, setModel] = useState(
    () =>
      localStorage.getItem("kodevo-model") ||
      DEFAULT_MODELS[localStorage.getItem("kodevo-provider") || "groq"]
  );

  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("kodevo-api-key") || ""
  );

  const [messages, setMessages] = useState(() =>
    loadJSON("kodevo-messages", [])
  );

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [project, setProject] = useState(() =>
    loadJSON("kodevo-project", INITIAL_PROJECT)
  );

  const [showSettings, setShowSettings] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileTab, setFileTab] = useState("preview");

  const [connectors, setConnectors] = useState(() =>
    loadJSON("kodevo-connectors", {
      GitHub: false,
      Supabase: false,
      Airtable: false,
      Dropbox: false,
      Vercel: false,
    })
  );

  const models = useMemo(() => DEFAULT_MODELS, []);

  useEffect(() => {
    localStorage.setItem("kodevo-provider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("kodevo-model", model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem("kodevo-api-key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem("kodevo-messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("kodevo-project", JSON.stringify(project));
  }, [project]);

  useEffect(() => {
    localStorage.setItem("kodevo-connectors", JSON.stringify(connectors));
  }, [connectors]);

  function changeProvider(value) {
    setProvider(value);
    setModel(DEFAULT_MODELS[value]);
  }

  function saveConfig() {
    localStorage.setItem("kodevo-provider", provider);
    localStorage.setItem("kodevo-model", model);
    localStorage.setItem("kodevo-api-key", apiKey);
    setShowSettings(false);
  }

  function newProject() {
    setMessages([]);
    setProject(INITIAL_PROJECT);
    setSelectedFile(null);
    localStorage.removeItem("kodevo-messages");
    localStorage.removeItem("kodevo-project");
  }

  function saveConnectors(next) {
    setConnectors(next);
    localStorage.setItem("kodevo-connectors", JSON.stringify(next));
  }

  function toggleConnector(name) {
    const next = {
      ...connectors,
      [name]: !connectors[name],
    };

    saveConnectors(next);
  }

  function detectMode(text) {
    const value = text.toLowerCase();

    if (
      value.includes("build") ||
      value.includes("create") ||
      value.includes("make") ||
      value.includes("develop")
    ) {
      return "build";
    }

    if (
      value.includes("fix") ||
      value.includes("bug") ||
      value.includes("error") ||
      value.includes("broken")
    ) {
      return "debug";
    }

    return "understand";
  }

  function extractFiles(text) {
    const files = [];
    const regex =
      /(?:^|\n)\s*(?:file\s*)?([a-zA-Z0-9_./-]+\.(?:html|css|js|jsx|ts|tsx|json|py|java|cpp|c|cs|go|rs|php|rb|swift|kt|sql|md|yml|yaml|xml|sh|bash|vue|svelte))\b/g;

    let match;

    while ((match = regex.exec(text)) !== null) {
      if (!files.includes(match[1])) {
        files.push(match[1]);
      }
    }

    return files;
  }

  async function callAI(conversation) {
    if (!apiKey.trim()) {
      throw new Error("Add your API key in Settings first.");
    }

    const systemPrompt = `
You are Kodevo, an advanced AI software engineering agent.

Your job is to understand the user's software project before writing code.

You can work with ANY programming language or file type.

Do not assume the project is HTML-only.

When the user's request is incomplete, ask useful questions before coding.
Ask only the questions that are actually necessary.

Once enough information is known:
1. Summarize your understanding.
2. Create a clear implementation plan.
3. Explain what you will build.
4. Then generate the required files.

During implementation, communicate progress naturally.

When generating files, clearly label them using:
FILE: filename.ext

Then provide the complete file contents.

Think like a senior software engineer and product designer.
`;

    const messagesForAI = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...conversation.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    let response;

    if (provider === "gemini") {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: messagesForAI
              .filter((m) => m.role !== "system")
              .map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              })),
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
          }),
        }
      );
    } else {
      const endpoint =
        provider === "groq"
          ? "https://api.groq.com/openai/v1/chat/completions"
          : "https://openrouter.ai/api/v1/chat/completions";

      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messagesForAI,
          temperature: 0.4,
        }),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          data?.error ||
          `API request failed with status ${response.status}`
      );
    }

    if (provider === "gemini") {
      return (
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("") || "No response returned."
      );
    }

    return data?.choices?.[0]?.message?.content || "No response returned.";
  async function sendMessage() {
    const text = input.trim();

    if (!text || loading) return;

    const userMessage = {
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await callAI(nextMessages);
      const files = extractFiles(response);

      if (files.length > 0) {
        setProject((current) => ({
          ...current,
          files: [
            ...current.files,
            ...files
              .filter(
                (file) =>
                  !current.files.some(
                    (existing) =>
                      (typeof existing === "string"
                        ? existing
                        : existing.name) === file
                  )
              )
              .map((file) => ({
                name: file,
                content: "",
                language: file.split(".").pop(),
              })),
          ],
        }));
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: response,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Error: ${error.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function getFileName(file) {
    return typeof file === "string" ? file : file.name;
  }

  function getFileContent(file) {
    return typeof file === "string" ? "" : file.content || "";
  }

  function isHTMLFile(file) {
    const name = getFileName(file).toLowerCase();

    return (
      name.endsWith(".html") ||
      name.endsWith(".htm")
    );
  }

  function openFile(file) {
    setSelectedFile(file);
    setFileTab(isHTMLFile(file) ? "preview" : "code");
  }

  if (showConnectors) {
    return (
      <div className="kodevo-fullscreen">
        <div className="kodevo-fullscreen-header">
          <button
            className="icon-button"
            onClick={() => setShowConnectors(false)}
          >
            ←
          </button>

          <div>
            <h1>Connectors</h1>
            <p>
              Connect Kodevo to the services your
              projects use.
            </p>
          </div>
        </div>

        <div className="connector-grid">
          {Object.entries(CONNECTOR_INFO).map(
            ([name, info]) => (
              <div
                className="connector-card"
                key={name}
              >
                <div className="connector-icon">
                  {info.icon}
                </div>

                <div className="connector-main">
                  <h3>{name}</h3>
                  <p>{info.description}</p>
                </div>

                <button
                  className={
                    connectors[name]
                      ? "connector-button connected"
                      : "connector-button"
                  }
                  onClick={() =>
                    toggleConnector(name)
                  }
                >
                  {connectors[name]
                    ? "Connected"
                    : "Connect"}
                </button>
              </div>
            )
          )}
        </div>

        <div className="connector-note">
          <strong>Connector system</strong>

          <p>
            These controls currently store connection
            state locally. Real authorization and API
            operations will be handled by Kodevo's
            secure backend/tool layer.
          </p>
        </div>
      </div>
    );
  }

  if (selectedFile) {
    const fileName = getFileName(selectedFile);
    const fileContent = getFileContent(selectedFile);

    return (
      <div className="kodevo-fullscreen file-viewer">
        <div className="kodevo-fullscreen-header">
          <button
            className="icon-button"
            onClick={() => setSelectedFile(null)}
          >
            ←
          </button>

          <div className="file-viewer-title">
            <div className="file-type-icon">
              {fileName
                .split(".")
                .pop()
                ?.toUpperCase()}
            </div>

            <div>
              <h1>{fileName}</h1>
              <p>Project file</p>
            </div>
          </div>
        </div>

        {isHTMLFile(selectedFile) && (
          <div className="file-tabs">
            <button
              className={
                fileTab === "preview"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFileTab("preview")
              }
            >
              Preview
            </button>

            <button
              className={
                fileTab === "code"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFileTab("code")
              }
            >
              Code
            </button>
          </div>
        )}

        <div className="file-viewer-body">
          {fileTab === "preview" &&
          isHTMLFile(selectedFile) ? (
            <iframe
              title={fileName}
              className="html-preview"
              srcDoc={fileContent}
            />
          ) : (
            <pre className="code-viewer">
              <code>
                {fileContent ||
                  "// File content will appear here."}
              </code>
            </pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="kodevo-app">
      <aside className="kodevo-sidebar">
        <div className="kodevo-brand">
          <div className="kodevo-logo">
            K
          </div>

          <span>Kodevo</span>
        </div>

        <div className="sidebar-actions">
          <button
            className="sidebar-button connector-sidebar-button"
            onClick={() =>
              setShowConnectors(true)
            }
          >
            <span>⌕</span>
            <span>Connector</span>
          </button>

          <button
            className="sidebar-button"
            onClick={newProject}
          >
            <span>＋</span>
            <span>New project</span>
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">
            PROJECT
          </div>

          {project.name ? (
            <div className="sidebar-project">
              <div className="project-dot" />

              <span>
                {project.name}
              </span>
            </div>
          ) : (
            <div className="sidebar-empty">
              No project yet
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">
            FILES
          </div>

          {project.files.length === 0 ? (
            <div className="sidebar-empty">
              Files appear while building
            </div>
          ) : (
            <div className="sidebar-files">
              {project.files.map(
                (file, index) => (
                  <button
                    className="sidebar-file"
                    key={`${getFileName(
                      file
                    )}-${index}`}
                    onClick={() =>
                      openFile(file)
                    }
                  >
                    <span>◇</span>

                    <span>
                      {getFileName(file)}
                    </span>
                  </button>
                )
              )}
            </div>
          )}
        </div>

        <div className="sidebar-bottom">
          <button
            className="sidebar-button"
            onClick={() =>
              setShowSettings(true)
            }
          >
            <span>⚙</span>
            <span>Settings</span>
          </button>
        </div>
      </aside>

      <main className="kodevo-main">
        <header className="kodevo-topbar">
          <div className="topbar-project">
            {project.name || "New project"}
          </div>

          <div className="topbar-actions">
            <button
              className="topbar-button"
              onClick={() =>
                setShowSettings(true)
              }
            >
              Settings
            </button>
          </div>
        </header>

        <section className="kodevo-workspace">
          {messages.length === 0 ? (
            <div className="kodevo-welcome">
              <div className="welcome-mark">
                K
              </div>

              <h1>
                What are you building?
              </h1>

              <p>
                Describe your idea. Kodevo will
                understand the requirements, ask
                the important questions, create a
                plan, and build it.
              </p>

              <div className="example-prompts">
                <button
                  onClick={() =>
                    setInput(
                      "I need a website for my business where customers can browse products and buy them."
                    )
                  }
                >
                  Build a business website
                </button>

                <button
                  onClick={() =>
                    setInput(
                      "Build me a full-stack application with authentication and a database."
                    )
                  }
                >
                  Build a full-stack app
                </button>

                <button
                  onClick={() =>
                    setInput(
                      "I want to create a mobile application. Help me plan it first."
                    )
                  }
                >
                  Plan a mobile app
                </button>
              </div>
            </div>
          ) : (
            <div className="kodevo-conversation">
              {messages.map(
                (message, index) => (
                  <div
                    className={
                      message.role === "user"
                        ? "message-row user-message"
                        : "message-row assistant-message"
                    }
                    key={`${message.role}-${index}`}
                  >
                    <div className="message-avatar">
                      {message.role === "user"
                        ? "U"
                        : "K"}
                    </div>

                    <div className="message-content">
                      <div className="message-role">
                        {message.role === "user"
                          ? "You"
                          : "Kodevo"}
                      </div>

                      <div className="message-text">
                        {message.content}
                      </div>
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="message-row assistant-message">
                  <div className="message-avatar">
                    K
                  </div>

                  <div className="message-content">
                    <div className="message-role">
                      Kodevo
                    </div>

                    <div className="thinking-indicator">
                      <span />
                      <span />
                      <span />
                      <em>
                        Thinking...
                      </em>
                    </div>
                  </div>
                </div>
              )}

              {project.files.length > 0 && (
                <div className="generated-files">
                  <div className="generated-files-title">
                    Project files
                  </div>

                  {project.files.map(
                    (file, index) => (
                      <button
                        className="file-card"
                        key={`${getFileName(
                          file
                        )}-${index}`}
                        onClick={() =>
                          openFile(file)
                        }
                      >
                        <div className="file-card-icon">
                          {getFileName(file)
                            .split(".")
                            .pop()
                            ?.toUpperCase()}
                        </div>

                        <div className="file-card-info">
                          <strong>
                            {getFileName(file)}
                          </strong>

                          <span>
                            Open file
                          </span>
                        </div>

                        <div className="file-card-arrow">
                          →
                        </div>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="kodevo-composer-wrap">
          <div className="kodevo-composer">
            <textarea
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Tell Kodevo what you want to build..."
              rows={1}
              disabled={loading}
            />

            <div className="composer-bottom">
              <div className="composer-info">
                <span>{provider}</span>
                <span>•</span>
                <span>{model}</span>
              </div>

              <button
                className="send-button"
                onClick={sendMessage}
                disabled={
                  !input.trim() || loading
                }
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      </main>

      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-panel">
            <div className="settings-header">
              <div>
                <h2>Settings</h2>

                <p>
                  Configure the AI provider used
                  by Kodevo.
                </p>
              </div>

              <button
                className="icon-button"
                onClick={() =>
                  setShowSettings(false)
                }
              >
                ×
              </button>
            </div>

            <label>Provider</label>

            <select
              value={provider}
              onChange={(event) =>
                changeProvider(
                  event.target.value
                )
              }
            >
              <option value="groq">
                Groq
              </option>

              <option value="openrouter">
                OpenRouter
              </option>

              <option value="gemini">
                Google Gemini
              </option>
            </select>

            <label>Model</label>

            <input
              value={model}
              onChange={(event) =>
                setModel(event.target.value)
              }
              placeholder="Model name"
            />

            <label>API key</label>

            <input
              type="password"
              value={apiKey}
              onChange={(event) =>
                setApiKey(event.target.value)
              }
              placeholder="Enter API key"
            />

            <button
              className="save-settings"
              onClick={saveConfig}
            >
              Save configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;