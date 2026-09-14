import { useEffect, useState } from "react";

const DEFAULT_MODELS = {
  groq: "llama-3.3-70b-versatile",
  openrouter: "openai/gpt-4o-mini",
  gemini: "gemini-2.0-flash",
};

const PROVIDERS = {
  groq: {
    name: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
  },
  openrouter: {
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
  },
  gemini: {
    name: "Google Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/models",
  },
};

const SYSTEM_PROMPT = `
You are Kodevo, an AI software engineering and application building assistant.

Your job is to help the user build complete software projects.

When the user asks you to BUILD, CREATE, or MODIFY an application:

1. Understand the requirements.
2. Decide what files are needed.
3. Generate complete working code.
4. Never give incomplete placeholder code unless the user specifically asks for it.
5. Keep dependencies minimal.
6. Make the application functional.

IMPORTANT FILE FORMAT:

For every file you create or modify, use exactly this format:

FILE: filename.ext
\`\`\`language
complete file contents
\`\`\`

Example:

FILE: index.html
\`\`\`html
<!DOCTYPE html>
<html>
...
</html>
\`\`\`

You may create multiple files.

Do not put explanations inside the code blocks.

For normal questions that do not require building files, answer normally.

When modifying an existing project, preserve useful existing functionality unless the user asks you to remove it.
`;

const INITIAL_PROJECT = {
  name: "Kodevo Project",
  purpose: "",
  platform: "Web",
  files: [],
};

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractFiles(text) {
  const files = [];

  const regex =
    /FILE:\s*([^\n]+)\n```[^\n]*\n([\s\S]*?)```/gi;

  let match;

  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim();
    const content = match[2];

    if (!files.some((file) => file.name === name)) {
      files.push({
        name,
        content,
        language: name.includes(".")
          ? name.split(".").pop()
          : "",
      });
    }
  }

  return files;
}

function getFileIcon(name) {
  const extension = name.split(".").pop().toLowerCase();

  if (extension === "html") return "HTML";
  if (extension === "css") return "CSS";
  if (extension === "js") return "JS";
  if (extension === "jsx") return "JSX";
  if (extension === "ts") return "TS";
  if (extension === "tsx") return "TSX";
  if (extension === "json") return "{}";
  if (extension === "md") return "MD";
  if (extension === "py") return "PY";

  return "FILE";
}

async function callAI(messages, provider, model, apiKey) {
  if (!apiKey) {
    throw new Error(
      "No API key found. Open Settings and enter your API key."
    );
  }

  const finalMessages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...messages,
  ];

  if (provider === "gemini") {
    const url =
      `${PROVIDERS.gemini.url}/${model}:generateContent?key=${apiKey}`;

    const contents = finalMessages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: message.content,
          },
        ],
      }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: SYSTEM_PROMPT,
            },
          ],
        },
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          `Gemini request failed (${response.status})`
      );
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("") || "";

    if (!text.trim()) {
      throw new Error("Gemini returned an empty response.");
    }

    return text;
  }

  const response = await fetch(PROVIDERS[provider].url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: finalMessages,
      temperature: 0.2,
      max_tokens: 8192,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `AI request failed (${response.status})`
    );
  }

  const text =
    data?.choices?.[0]?.message?.content || "";

  if (!text.trim()) {
    throw new Error("AI returned an empty response.");
  }

  return text;
}

export default function App() {
  const [provider, setProvider] = useState(
    () =>
      localStorage.getItem("kodevo_provider") ||
      "groq"
  );

  const [model, setModel] = useState(
    () =>
      localStorage.getItem("kodevo_model") ||
      DEFAULT_MODELS.groq
  );

  const [apiKey, setApiKey] = useState(
    () =>
      localStorage.getItem("kodevo_api_key") || ""
  );

  const [messages, setMessages] = useState(() =>
    loadJSON("kodevo_messages", [])
  );

  const [project, setProject] = useState(() =>
    loadJSON("kodevo_project", INITIAL_PROJECT)
  );

  const [input, setInput] = useState("");

  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("chat");

  const [selectedFile, setSelectedFile] = useState(null);

  const [showSettings, setShowSettings] = useState(false);

  const [showFiles, setShowFiles] = useState(true);

  useEffect(() => {
    localStorage.setItem("kodevo_provider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("kodevo_model", model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem("kodevo_api_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem(
      "kodevo_messages",
      JSON.stringify(messages)
    );
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(
      "kodevo_project",
      JSON.stringify(project)
    );
  }, [project]);

  function changeProvider(value) {
    setProvider(value);
    setModel(DEFAULT_MODELS[value]);
  }

  function updateProjectFiles(newFiles) {
    setProject((current) => ({
      ...current,
      files: newFiles,
    }));
  }

  async function sendMessage(event) {
    event?.preventDefault();

    const text = input.trim();

    if (!text || loading) {
      return;
    }

    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }

    const userMessage = {
      role: "user",
      content: text,
    };

    const nextMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await callAI(
        nextMessages,
        provider,
        model,
        apiKey
      );

      const generatedFiles = extractFiles(response);

      if (generatedFiles.length > 0) {
        const currentFiles = project.files || [];

        const updatedFiles = [...currentFiles];

        for (const generatedFile of generatedFiles) {
          const existingIndex = updatedFiles.findIndex(
            (file) => file.name === generatedFile.name
          );

          if (existingIndex >= 0) {
            updatedFiles[existingIndex] = generatedFile;
          } else {
            updatedFiles.push(generatedFile);
          }
        }

        updateProjectFiles(updatedFiles);

        setSelectedFile(generatedFiles[0].name);
      }

      const assistantMessage = {
        role: "assistant",
        content: response,
      };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);
    } catch (error) {
      const errorMessage = {
        role: "assistant",
        content:
          `Error: ${error.message || "Something went wrong."}`,
      };

      setMessages((current) => [
        ...current,
        errorMessage,
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    localStorage.removeItem("kodevo_messages");
  }

  function clearProject() {
    const freshProject = {
      ...INITIAL_PROJECT,
      name: "Kodevo Project",
    };

    setProject(freshProject);
    setSelectedFile(null);
  }

  const selectedFileData =
    project.files?.find(
      (file) => file.name === selectedFile
    ) || null;

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.logoArea}>
          <div style={styles.logo}>K</div>

          <div>
            <div style={styles.logoText}>Kodevo</div>
            <div style={styles.logoSub}>
              AI Software Engineer
            </div>
          </div>
        </div>

        <div style={styles.headerRight}>
          <button
            style={styles.headerButton}
            onClick={() => setShowSettings(true)}
          >
            Settings
          </button>

          <button
            style={styles.headerButton}
            onClick={clearChat}
          >
            Clear Chat
          </button>
        </div>
      </header>

      <div style={styles.body}>
        <aside
          style={{
            ...styles.sidebar,
            width: showFiles ? 250 : 0,
            padding: showFiles ? 16 : 0,
            overflow: "hidden",
          }}
        >
          <div style={styles.sidebarTitle}>
            PROJECT
          </div>

          <div style={styles.projectName}>
            {project.name}
          </div>

          <div style={styles.fileList}>
            {project.files?.length === 0 && (
              <div style={styles.emptyFiles}>
                No files yet.
                <br />
                Ask Kodevo to build something.
              </div>
            )}

            {project.files?.map((file) => (
              <button
                key={file.name}
                onClick={() => {
                  setSelectedFile(file.name);
                  setActiveTab("files");
                }}
                style={{
                  ...styles.fileButton,
                  ...(selectedFile === file.name
                    ? styles.fileButtonActive
                    : {}),
                }}
              >
                <span style={styles.fileIcon}>
                  {getFileIcon(file.name)}
                </span>

                <span style={styles.fileName}>
                  {file.name}
                </span>
              </button>
            ))}
          </div>

          <button
            style={styles.newProjectButton}
            onClick={clearProject}
          >
            + New Project
          </button>
        </aside>

        <main style={styles.main}>
          <div style={styles.tabs}>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === "chat"
                  ? styles.tabActive
                  : {}),
              }}
              onClick={() => setActiveTab("chat")}
            >
              Chat
            </button>

            <button
              style={{
                ...styles.tab,
                ...(activeTab === "files"
                  ? styles.tabActive
                  : {}),
              }}
              onClick={() => setActiveTab("files")}
            >
              Files
            </button>

            <button
              style={{
                ...styles.tab,
                ...(activeTab === "preview"
                  ? styles.tabActive
                  : {}),
              }}
              onClick={() => setActiveTab("preview")}
            >
              Preview
            </button>

            <button
              style={styles.sidebarToggle}
              onClick={() => setShowFiles((value) => !value)}
            >
              {showFiles ? "Hide Files" : "Show Files"}
            </button>
          </div>

          {activeTab === "chat" && (
            <div style={styles.chatArea}>
              <div style={styles.messages}>
                {messages.length === 0 && (
                  <div style={styles.welcome}>
                    <div style={styles.welcomeLogo}>
                      K
                    </div>

                    <h1 style={styles.welcomeTitle}>
                      What do you want to build?
                    </h1>

                    <p style={styles.welcomeText}>
                      Describe an application, website,
                      feature, or coding problem.
                    </p>

                    <div style={styles.examples}>
                      <button
                        onClick={() =>
                          setInput(
                            "Build a modern todo application with HTML, CSS and JavaScript."
                          )
                        }
                        style={styles.example}
                      >
                        Build a todo app
                      </button>

                      <button
                        onClick={() =>
                          setInput(
                            "Build a landing page for an AI startup."
                          )
                        }
                        style={styles.example}
                      >
                        Build a landing page
                      </button>

                      <button
                        onClick={() =>
                          setInput(
                            "Create a responsive dashboard UI."
                          )
                        }
                        style={styles.example}
                      >
                        Create a dashboard
                      </button>
                    </div>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div
                    key={index}
                    style={{
                      ...styles.message,
                      ...(message.role === "user"
                        ? styles.userMessage
                        : styles.assistantMessage),
                    }}
                  >
                    <div style={styles.messageRole}>
                      {message.role === "user"
                        ? "You"
                        : "Kodevo"}
                    </div>

                    <pre style={styles.messageContent}>
                      {message.content}
                    </pre>
                  </div>
                ))}

                {loading && (
                  <div
                    style={{
                      ...styles.message,
                      ...styles.assistantMessage,
                    }}
                  >
                    <div style={styles.messageRole}>
                      Kodevo
                    </div>

                    <div style={styles.loading}>
                      Kodevo is working...
                    </div>
                  </div>
                )}
              </div>

              <form
                onSubmit={sendMessage}
                style={styles.inputArea}
              >
                <textarea
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  placeholder="Describe what you want Kodevo to build..."
                  style={styles.textarea}
                  rows={3}
                  disabled={loading}
                />

                <div style={styles.inputBottom}>
                  <div style={styles.providerLabel}>
                    {PROVIDERS[provider].name} · {model}
                  </div>

                  <button
                    type="submit"
                    style={styles.sendButton}
                    disabled={loading || !input.trim()}
                  >
                    {loading ? "Working..." : "Send"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "files" && (
            <div style={styles.fileViewer}>
              {!selectedFileData ? (
                <div style={styles.emptyViewer}>
                  Select a file from the sidebar.
                </div>
              ) : (
                <>
                  <div style={styles.viewerHeader}>
                    <span>
                      {getFileIcon(selectedFileData.name)}
                    </span>

                    <span>
                      {selectedFileData.name}
                    </span>
                  </div>

                  <pre style={styles.codeViewer}>
                    {selectedFileData.content}
                  </pre>
                </>
              )}
            </div>
          )}

          {activeTab === "preview" && (
            <div style={styles.previewArea}>
              {selectedFileData &&
              selectedFileData.name
                .toLowerCase()
                .endsWith(".html") ? (
                <iframe
                  title="Kodevo Preview"
                  srcDoc={selectedFileData.content}
                  style={styles.previewFrame}
                  sandbox="allow-scripts"
                />
              ) : (
                <div style={styles.emptyViewer}>
                  Select an HTML file to preview it.
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {showSettings && (
        <div
          style={styles.overlay}
          onClick={() => setShowSettings(false)}
        >
          <div
            style={styles.modal}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                Kodevo Settings
              </h2>

              <button
                style={styles.closeButton}
                onClick={() =>
                  setShowSettings(false)
                }
              >
                ×
              </button>
            </div>

            <label style={styles.label}>
              AI Provider
            </label>

            <select
              value={provider}
              onChange={(event) =>
                changeProvider(event.target.value)
              }
              style={styles.input}
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

            <label style={styles.label}>
              Model
            </label>

            <input
              value={model}
              onChange={(event) =>
                setModel(event.target.value)
              }
              style={styles.input}
              placeholder="Model name"
            />

            <label style={styles.label}>
              API Key
            </label>

            <input
              type="password"
              value={apiKey}
              onChange={(event) =>
                setApiKey(event.target.value)
              }
              style={styles.input}
              placeholder="Enter your API key"
            />

            <div style={styles.warning}>
              Prototype only: the API key is stored in
              your browser's local storage. Do not use
              this approach for a public production app.
            </div>

            <button
              style={styles.saveButton}
              onClick={() =>
                setShowSettings(false)
              }
            >
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#0b0d10",
    color: "#f5f7fa",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
  },

  header: {
    height: 64,
    borderBottom: "1px solid #20242b",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 18px",
    background: "#0f1115",
  },

  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "#ffffff",
    color: "#0b0d10",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 19,
  },

  logoText: {
    fontWeight: 750,
    fontSize: 17,
  },

  logoSub: {
    color: "#858c98",
    fontSize: 11,
  },

  headerRight: {
    display: "flex",
    gap: 8,
  },

  headerButton: {
    background: "#171a20",
    color: "#dce1e8",
    border: "1px solid #292e37",
    borderRadius: 8,
    padding: "8px 12px",
    cursor: "pointer",
  },

  body: {
    display: "flex",
    flex: 1,
    minHeight: 0,
  },

  sidebar: {
    borderRight: "1px solid #20242b",
    background: "#0e1014",
    transition: "width 0.2s ease",
    flexShrink: 0,
  },

  sidebarTitle: {
    color: "#707784",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom: 8,
  },

  projectName: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 16,
  },

  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  fileButton: {
    width: "100%",
    border: "1px solid transparent",
    background: "transparent",
    color: "#aeb5c0",
    borderRadius: 7,
    padding: "8px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    textAlign: "left",
  },

  fileButtonActive: {
    background: "#191d24",
    borderColor: "#2b3039",
    color: "#ffffff",
  },

  fileIcon: {
    width: 34,
    textAlign: "center",
    fontSize: 9,
    fontWeight: 700,
    color: "#8f98a6",
  },

  fileName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  emptyFiles: {
    color: "#626a76",
    fontSize: 12,
    lineHeight: 1.6,
    padding: "10px 4px",
  },

  newProjectButton: {
    width: "100%",
    marginTop: 20,
    padding: 9,
    background: "#15181d",
    color: "#cfd4dc",
    border: "1px solid #292e36",
    borderRadius: 8,
    cursor: "pointer",
  },

  main: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },

  tabs: {
    height: 48,
    borderBottom: "1px solid #20242b",
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
    gap: 5,
  },

  tab: {
    border: "none",
    background: "transparent",
    color: "#777f8c",
    padding: "8px 12px",
    borderRadius: 7,
    cursor: "pointer",
  },

  tabActive: {
    background: "#191d24",
    color: "#ffffff",
  },

  sidebarToggle: {
    marginLeft: "auto",
    background: "transparent",
    color: "#777f8c",
    border: "none",
    cursor: "pointer",
  },

  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },

  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px max(18px, 6vw)",
  },

  welcome: {
    maxWidth: 720,
    margin: "80px auto",
    textAlign: "center",
  },

  welcomeLogo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: "#ffffff",
    color: "#0b0d10",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
    fontWeight: 800,
    fontSize: 28,
  },

  welcomeTitle: {
    fontSize: 30,
    margin: 0,
  },

  welcomeText: {
    color: "#858d99",
    marginTop: 10,
  },

  examples: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 25,
  },

  example: {
    background: "#15181d",
    border: "1px solid #292e36",
    color: "#c9ced6",
    padding: "9px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },

  message: {
    maxWidth: 900,
    margin: "0 auto 18px",
    borderRadius: 10,
    padding: 14,
  },

  userMessage: {
    background: "#171a20",
    border: "1px solid #292e36",
  },

  assistantMessage: {
    background: "#101318",
    border: "1px solid #20242b",
  },

  messageRole: {
    fontWeight: 700,
    fontSize: 12,
    color: "#8d95a1",
    marginBottom: 8,
  },

  messageContent: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: "inherit",
    lineHeight: 1.55,
  },

  loading: {
    color: "#9aa2ae",
  },

  inputArea: {
    padding: 14,
    borderTop: "1px solid #20242b",
    background: "#0e1014",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    background: "#15181d",
    border: "1px solid #303640",
    borderRadius: 10,
    color: "#ffffff",
    padding: 13,
    outline: "none",
    fontFamily: "inherit",
    fontSize: 14,
  },

  inputBottom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },

  providerLabel: {
    color: "#666e7b",
    fontSize: 11,
  },

  sendButton: {
    background: "#ffffff",
    color: "#0b0d10",
    border: "none",
    borderRadius: 8,
    padding: "9px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },

  fileViewer: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },

  viewerHeader: {
    height: 48,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 16px",
    borderBottom: "1px solid #20242b",
    color: "#cfd5dd",
    fontSize: 13,
  },

  codeViewer: {
    flex: 1,
    margin: 0,
    padding: 20,
    overflow: "auto",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.6,
    color: "#d6dbe3",
  },

  emptyViewer: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#626a76",
  },

  previewArea: {
    flex: 1,
    minHeight: 0,
    background: "#ffffff",
  },

  previewFrame: {
    width: "100%",
    height: "100%",
    minHeight: "calc(100vh - 112px)",
    border: "none",
    background: "#ffffff",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 20,
  },

  modal: {
    width: "min(460px, 100%)",
    background: "#111419",
    border: "1px solid #2b3038",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  modalTitle: {
    margin: 0,
    fontSize: 20,
  },

  closeButton: {
    background: "transparent",
    color: "#9299a4",
    border: "none",
    fontSize: 25,
    cursor: "pointer",
  },

  label: {
    display: "block",
    fontSize: 12,
    color: "#8b939f",
    marginBottom: 6,
    marginTop: 14,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#181b21",
    border: "1px solid #303640",
    color: "#ffffff",
    borderRadius: 8,
    padding: 10,
    outline: "none",
  },

  warning: {
    marginTop: 16,
    padding: 10,
    background: "#1a1813",
    border: "1px solid #3a3224",
    borderRadius: 8,
    color: "#a69a83",
    fontSize: 11,
    lineHeight: 1.5,
  },

  saveButton: {
    width: "100%",
    marginTop: 18,
    padding: 11,
    background: "#ffffff",
    color: "#0b0d10",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
  },
};