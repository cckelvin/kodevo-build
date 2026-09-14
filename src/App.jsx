import { useEffect, useMemo, useState } from "react";

const DEFAULT_MODELS = {
  Groq: "llama-3.3-70b-versatile",
  OpenRouter: "openai/gpt-4o-mini",
  Gemini: "gemini-2.0-flash"
};

const INITIAL_PROJECT = {
  name: "Untitled project",
  stage: "understand",
  requirements: [],
  files: []
};

function App() {
  const [provider, setProvider] = useState("Groq");
  const [model, setModel] = useState(DEFAULT_MODELS.Groq);
  const [apiKey, setApiKey] = useState("");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const [project, setProject] = useState(INITIAL_PROJECT);

  const [showSettings, setShowSettings] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileView, setFileView] = useState("code");

  const [connectors, setConnectors] = useState({
    GitHub: false,
    Supabase: false,
    Airtable: false,
    Dropbox: false,
    Vercel: false
  });

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
        console.log("Could not load configuration.");
      }
    }

    const savedConnectors =
      localStorage.getItem("kodevo-connectors");

    if (savedConnectors) {
      try {
        setConnectors(JSON.parse(savedConnectors));
      } catch {
        console.log("Could not load connectors.");
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

  const saveConnectors = (next) => {
    setConnectors(next);

    localStorage.setItem(
      "kodevo-connectors",
      JSON.stringify(next)
    );
  };

  const newProject = () => {
    setMessages([]);

    setProject({
      ...INITIAL_PROJECT,
      name: "Untitled project"
    });

    setMessage("");
    setSelectedFile(null);
  };

  const changeProvider = (event) => {
    const nextProvider = event.target.value;

    setProvider(nextProvider);

    setModel(
      DEFAULT_MODELS[nextProvider] || ""
    );
  };

  const detectStage = (text) => {
    const value = text.toLowerCase();

    if (
      value.includes("build") ||
      value.includes("create") ||
      value.includes("code") ||
      value.includes("implement")
    ) {
      return "plan";
    }

    return "understand";
  };

  const extractFiles = (text) => {
    const files = [];

    const regex =
      /(?:```|~~~)\s*(?:[a-zA-Z0-9+#.-]+)?\s*(?:\n)?([\s\S]*?)(?:```|~~~)/g;

    let match;
    let counter = 1;

    while ((match = regex.exec(text)) !== null) {
      const code = match[1].trim();

      if (!code) continue;

      let filename = `file-${counter}.txt`;

      const lines = code.split("\n");

      if (
        lines[0].startsWith("// FILE:") ||
        lines[0].startsWith("# FILE:") ||
        lines[0].startsWith("/* FILE:")
      ) {
        filename = lines[0]
          .replace("// FILE:", "")
          .replace("# FILE:", "")
          .replace("/* FILE:", "")
          .replace("*/", "")
          .trim();

        lines.shift();
      }

      files.push({
        id: `${Date.now()}-${counter}`,
        name: filename,
        content: lines.join("\n"),
        status: "complete"
      });

      counter++;
    }

    return files;
  };

  const callAI = async (
    userMessage,
    previousMessages,
    mode
  ) => {
    if (!apiKey.trim()) {
      throw new Error(
        "Please enter your API key in Settings."
      );
    }

    let systemPrompt = `
You are Kodevo, an advanced AI software-building agent.

You are NOT limited to HTML.

You can work with:
HTML, CSS, JavaScript, TypeScript, React, Next.js,
Python, Java, C, C++, C#, PHP, Go, Rust, SQL,
JSON, YAML, shell scripts and other programming languages.

Your job is to understand the user's goal before coding.

Do not immediately start coding when important requirements
are missing.

Ask useful questions naturally, one or a few at a time.

Remember decisions made during the conversation.

When enough information is known, create a clear implementation
plan.

When the user confirms the plan or clearly asks you to build,
begin implementation.

During implementation:
- Explain what you are doing.
- Break the work into logical stages.
- Identify files being created or changed.
- Respect the requested design.
- Respect the requested programming language/framework.
- Think about responsive design where appropriate.
- Consider accessibility.
- Consider errors and edge cases.
- Do not claim that an external service was actually connected
  unless a real tool has performed that action.

When producing code files, use this format:

// FILE: path/to/file.ext
code here

Place each file inside its own fenced code block.

The filename must appear immediately after FILE:.

Do not assume the project is a website.
The project can be any type of software.
`;

    if (mode === "plan") {
      systemPrompt += `
The user is currently moving toward implementation.

First understand whether requirements are sufficient.
If they are not sufficient, ask the missing questions.

If they are sufficient, produce:
1. Understanding
2. Plan
3. Architecture
4. Files that will be created
5. Technologies
6. Next implementation step

Do not pretend that files have already been created.
`;
    }

    if (mode === "build") {
      systemPrompt += `
The user is now asking you to build.

Provide the implementation and actual source files.

After each logical group of files, explain what has been
completed and what you are doing next.
`;
    }

    const conversation = [
      {
        role: "system",
        content: systemPrompt
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
              .filter(
                (item) => item.role !== "system"
              )
              .map((item) => ({
                role:
                  item.role === "assistant"
                    ? "model"
                    : "user",
                parts: [
                  {
                    text: item.content
                  }
                ]
              })),
            systemInstruction: {
              parts: [
                {
                  text: systemPrompt
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
          temperature: 0.5
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

    const userItem = {
      role: "user",
      content: text
    };

    const previousMessages = messages;

    setMessages((current) => [
      ...current,
      userItem
    ]);

    setMessage("");
    setLoading(true);

    const nextStage = detectStage(text);

    if (nextStage === "plan") {
      setProject((current) => ({
        ...current,
        stage: "plan"
      }));
    }

    try {
      const answer = await callAI(
        text,
        previousMessages,
        nextStage === "plan"
          ? "plan"
          : project.stage === "plan"
          ? "build"
          : "understand"
      );

      const newFiles = extractFiles(answer);

      if (newFiles.length > 0) {
        setProject((current) => ({
          ...current,
          stage: "build",
          files: [
            ...current.files,
            ...newFiles
          ]
        }));
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: answer
        }
      ]);

      if (
        newFiles.length > 0
      ) {
        setProject((current) => ({
          ...current,
          stage: "build"
        }));
      }
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

  const projectStageText = useMemo(() => {
    switch (project.stage) {
      case "understand":
        return "Understanding";
      case "plan":
        return "Planning";
      case "build":
        return "Building";
      case "verify":
        return "Verifying";
      case "done":
        return "Complete";
      default:
        return "Working";
    }
  }, [project.stage]);

  const toggleConnector = (name) => {
    const next = {
      ...connectors,
      [name]: !connectors[name]
    };

    saveConnectors(next);
  };

Part 2

  if (showConnectors) {
    return (
      <div className="connector-page">

        <header className="connector-header">

          <button
            className="back-button"
            onClick={() =>
              setShowConnectors(false)
            }
          >
            ←
          </button>

          <div>
            <h1>Connectors</h1>
            <p>
              Give Kodevo access to your development
              tools and services.
            </p>
          </div>

        </header>

        <div className="connector-grid">

          {[
            {
              name: "GitHub",
              icon: "◉",
              description:
                "Repositories, files, branches and commits."
            },
            {
              name: "Supabase",
              icon: "◆",
              description:
                "Database, authentication and storage."
            },
            {
              name: "Airtable",
              icon: "▦",
              description:
                "Tables, records and structured data."
            },
            {
              name: "Dropbox",
              icon: "◇",
              description:
                "Files, folders and project assets."
            },
            {
              name: "Vercel",
              icon: "▲",
              description:
                "Deploy projects and manage deployments."
            },
            {
              name: "More",
              icon: "+",
              description:
                "More integrations will be added."
            }
          ].map((item) => (
            <div
              className="connector-card"
              key={item.name}
            >

              <div className="connector-icon">
                {item.icon}
              </div>

              <div className="connector-info">
                <h2>{item.name}</h2>

                <p>
                  {item.description}
                </p>
              </div>

              {item.name === "More" ? (
                <button
                  className="connector-connect disabled"
                  disabled
                >
                  Soon
                </button>
              ) : (
                <button
                  className={`connector-connect ${
                    connectors[item.name]
                      ? "connected"
                      : ""
                  }`}
                  onClick={() =>
                    toggleConnector(item.name)
                  }
                >
                  {connectors[item.name]
                    ? "Connected"
                    : "Connect"}
                </button>
              )}

            </div>
          ))}

        </div>

      </div>
    );
  }

  if (selectedFile) {
    return (
      <div className="file-page">

        <header className="file-header">

          <button
            className="back-button"
            onClick={() =>
              setSelectedFile(null)
            }
          >
            ←
          </button>

          <div className="file-title">
            {selectedFile.name}
          </div>

          <div className="file-tabs">

            <button
              className={
                fileView === "code"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFileView("code")
              }
            >
              Code
            </button>

            {[
              "html",
              "htm"
            ].includes(
              selectedFile.name
                .split(".")
                .pop()
                .toLowerCase()
            ) && (
              <button
                className={
                  fileView === "preview"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFileView("preview")
                }
              >
                Preview
              </button>
            )}

          </div>

        </header>

        <div className="file-viewer">

          {fileView === "preview" ? (
            <iframe
              title={selectedFile.name}
              className="preview-frame"
              srcDoc={selectedFile.content}
            />
          ) : (
            <pre className="code-view">
              <code>
                {selectedFile.content}
              </code>
            </pre>
          )}

        </div>

      </div>
    );
  }

  return (
    <div className="app">

      <aside className="sidebar">

        <div className="brand">
          <div className="logo">
            K
          </div>

          <span>Kodevo</span>
        </div>

        <button
          className="connector-button"
          onClick={() =>
            setShowConnectors(true)
          }
        >
          <span className="plug">
            ⎋
          </span>

          Connectors
        </button>

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

            {project.name}
          </div>

        </div>

        <div className="sidebar-bottom">

          <button
            className="sidebar-button"
            onClick={() =>
              setShowSettings(true)
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
            {project.name}
          </div>

          <div className="top-actions">

            <div className="stage-badge">
              {projectStageText}
            </div>

            <div className="provider-badge">
              {provider}
              {model
                ? ` · ${model}`
                : ""}
            </div>

            <button
              className="settings-button"
              onClick={() =>
                setShowSettings(true)
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
                What are you building?
              </h1>

              <p>
                Describe your idea. Kodevo will
                understand the project, ask questions,
                create a plan and then build it.
              </p>

              <div className="suggestions">

                <button
                  onClick={() =>
                    setMessage(
                      "I need a website for my business where I can sell products."
                    )
                  }
                >
                  Build a business
                </button>

                <button
                  onClick={() =>
                    setMessage(
                      "I need a full-stack application."
                    )
                  }
                >
                  Build an application
                </button>

                <button
                  onClick={() =>
                    setMessage(
                      "I need a Python tool."
                    )
                  }
                >
                  Build software
                </button>

              </div>

            </div>

          ) : (

            <div className="conversation">

              {messages.map(
                (item, index) => (

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

                )
              )}

              {project.files.length > 0 && (

                <div className="file-section">

                  <div className="file-section-title">
                    Project files
                  </div>

                  {project.files.map(
                    (file) => (

                      <button
                        className="file-card"
                        key={file.id}
                        onClick={() =>
                          setSelectedFile(file)
                        }
                      >

                        <span className="file-status">
                          {file.status ===
                          "complete"
                            ? "✓"
                            : "◌"}
                        </span>

                        <span className="file-name">
                          {file.name}
                        </span>

                        <span className="file-arrow">
                          ›
                        </span>

                      </button>

                    )
                  )}

                </div>

          if (showConnectors) {
    return (
      <div className="connector-page">

        <header className="connector-header">

          <button
            className="back-button"
            onClick={() =>
              setShowConnectors(false)
            }
          >
            ←
          </button>

          <div>
            <h1>Connectors</h1>
            <p>
              Give Kodevo access to your development
              tools and services.
            </p>
          </div>

        </header>

        <div className="connector-grid">

          {[
            {
              name: "GitHub",
              icon: "◉",
              description:
                "Repositories, files, branches and commits."
            },
            {
              name: "Supabase",
              icon: "◆",
              description:
                "Database, authentication and storage."
            },
            {
              name: "Airtable",
              icon: "▦",
              description:
                "Tables, records and structured data."
            },
            {
              name: "Dropbox",
              icon: "◇",
              description:
                "Files, folders and project assets."
            },
            {
              name: "Vercel",
              icon: "▲",
              description:
                "Deploy projects and manage deployments."
            },
            {
              name: "More",
              icon: "+",
              description:
                "More integrations will be added."
            }
          ].map((item) => (
            <div
              className="connector-card"
              key={item.name}
            >

              <div className="connector-icon">
                {item.icon}
              </div>

              <div className="connector-info">
                <h2>{item.name}</h2>

                <p>
                  {item.description}
                </p>
              </div>

              {item.name === "More" ? (
                <button
                  className="connector-connect disabled"
                  disabled
                >
                  Soon
                </button>
              ) : (
                <button
                  className={`connector-connect ${
                    connectors[item.name]
                      ? "connected"
                      : ""
                  }`}
                  onClick={() =>
                    toggleConnector(item.name)
                  }
                >
                  {connectors[item.name]
                    ? "Connected"
                    : "Connect"}
                </button>
              )}

            </div>
          ))}

        </div>

      </div>
    );
  }

  if (selectedFile) {
    return (
      <div className="file-page">

        <header className="file-header">

          <button
            className="back-button"
            onClick={() =>
              setSelectedFile(null)
            }
          >
            ←
          </button>

          <div className="file-title">
            {selectedFile.name}
          </div>

          <div className="file-tabs">

            <button
              className={
                fileView === "code"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFileView("code")
              }
            >
              Code
            </button>

            {[
              "html",
              "htm"
            ].includes(
              selectedFile.name
                .split(".")
                .pop()
                .toLowerCase()
            ) && (
              <button
                className={
                  fileView === "preview"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFileView("preview")
                }
              >
                Preview
              </button>
            )}

          </div>

        </header>

        <div className="file-viewer">

          {fileView === "preview" ? (
            <iframe
              title={selectedFile.name}
              className="preview-frame"
              srcDoc={selectedFile.content}
            />
          ) : (
            <pre className="code-view">
              <code>
                {selectedFile.content}
              </code>
            </pre>
          )}

        </div>

      </div>
    );
  }

  return (
    <div className="app">

      <aside className="sidebar">

        <div className="brand">
          <div className="logo">
            K
          </div>

          <span>Kodevo</span>
        </div>

        <button
          className="connector-button"
          onClick={() =>
            setShowConnectors(true)
          }
        >
          <span className="plug">
            ⎋
          </span>

          Connectors
        </button>

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

            {project.name}
          </div>

        </div>

        <div className="sidebar-bottom">

          <button
            className="sidebar-button"
            onClick={() =>
              setShowSettings(true)
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
            {project.name}
          </div>

          <div className="top-actions">

            <div className="stage-badge">
              {projectStageText}
            </div>

            <div className="provider-badge">
              {provider}
              {model
                ? ` · ${model}`
                : ""}
            </div>

            <button
              className="settings-button"
              onClick={() =>
                setShowSettings(true)
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
                What are you building?
              </h1>

              <p>
                Describe your idea. Kodevo will
                understand the project, ask questions,
                create a plan and then build it.
              </p>

              <div className="suggestions">

                <button
                  onClick={() =>
                    setMessage(
                      "I need a website for my business where I can sell products."
                    )
                  }
                >
                  Build a business
                </button>

                <button
                  onClick={() =>
                    setMessage(
                      "I need a full-stack application."
                    )
                  }
                >
                  Build an application
                </button>

                <button
                  onClick={() =>
                    setMessage(
                      "I need a Python tool."
                    )
                  }
                >
                  Build software
                </button>

              </div>

            </div>

          ) : (

            <div className="conversation">

              {messages.map(
                (item, index) => (

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

                )
              )}

              {project.files.length > 0 && (

                <div className="file-section">

                  <div className="file-section-title">
                    Project files
                  </div>

                  {project.files.map(
                    (file) => (

                      <button
                        className="file-card"
                        key={file.id}
                        onClick={() =>
                          setSelectedFile(file)
                        }
                      >

                        <span className="file-status">
                          {file.status ===
                          "complete"
                            ? "✓"
                            : "◌"}
                        </span>

                        <span className="file-name">
                          {file.name}
                        </span>

                        <span className="file-arrow">
                          ›
                        </span>

                      </button>

                    )
                  )}

                </div>

              )}

              {loading && (

                <div className="agent-working">

                  <div className="agent-spinner" />

                  <div>
                    <strong>
                      Kodevo is working
                    </strong>

                    <span>
                      Understanding your project
                      and preparing the next step...
                    </span>
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
                setMessage(
                  event.target.value
                )
              }
              onKeyDown={(event) => {

                if (
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  sendMessage();
                }

              }}
              placeholder={
                project.stage === "plan"
                  ? "Answer Kodevo's questions or approve the plan..."
                  : "Describe what you want Kodevo to build..."
              }
            />

            <div className="composer-bottom">

              <div className="composer-tools">

                <button
                  title="Attach files"
                >
                  +
                </button>

                <button
                  title="Code mode"
                >
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
            onChange={changeProvider}
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
            This prototype stores the provider
            configuration locally.
          </div>

        </aside>

      )}

    </div>
  );
}

export default App;