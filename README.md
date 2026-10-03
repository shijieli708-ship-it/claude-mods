# claude-mods

Mods for [Claude Code](https://code.claude.com/docs/en/plugins/mods/overview): plugins whose hooks run inside Claude Code and can draw in its interface. Works in the terminal and in the Code tab of the Claude desktop app.

[中文说明](#中文说明)

## Mods

| Mod | What it does |
| :- | :- |
| [`inline-next-steps`](plugins/inline-next-steps) | Claude lists what you might ask next at the end of its final answer. The list is hidden from the transcript and shown as checkboxes above the prompt. Tick some, and they go into the prompt box for you to edit and send. No extra model calls. |

## Install

Requires Claude Code with mods support (v2.1.286 or later).

```bash
claude plugin marketplace add shijieli708-ship-it/claude-mods
claude plugin install inline-next-steps@claude-mods
```

Then start a new session, or run `/reload-plugins` in an open one.

## inline-next-steps

### How it works

1. **Instructions**: on each prompt you send, the mod attaches a short instruction as context you don't see. It asks Claude to end its final answer with a `<next-steps>` block: 2 to 6 next steps for work, or 1 to 3 follow-up questions for a plain question. Each line is `short label | the full request`.
2. **Hiding**: the block is removed from how the reply is drawn. The stored conversation is left untouched, so the model's thinking blocks stay valid.
3. **Buttons**: when the turn ends, the block becomes checkboxes in the band above the prompt.
4. **Put in prompt**: the ticked requests go into the prompt box, numbered if there are several. Nothing is sent until you press Enter.

### Cost

No extra model calls. The suggestions are written by the model that is already answering, which already has the whole conversation in context. Each turn costs roughly 100 extra output tokens for the block and about 250 input tokens for the instruction, which is cached afterwards.

Compared with mods that ask a second model for suggestions after each turn, this avoids re-reading the conversation, and the suggestions can draw on everything in it, not only the last exchange.

### Limits

- The model may now and then leave the block out or write it in a different shape; that turn simply shows no buttons.
- Instructions are attached only where the mod can draw: the terminal and the desktop app. Elsewhere (the VS Code chat panel, `claude -p`) nothing is attached, so no raw block appears.
- While a reply streams in, the block is hidden as soon as its opening tag arrives.

## Writing your own

Each mod is a plugin directory under `plugins/` with `.claude-plugin/plugin.json`, `hooks/hooks.json` and a hooks module. See the [mods documentation](https://code.claude.com/docs/en/plugins/mods/overview). Check a mod before loading it with:

```bash
claude plugin validate plugins/<mod>
```

## License

[MIT](LICENSE)

---

## 中文说明

这里是 Claude Code 的 mod。mod 是一种插件，它的代码在 Claude Code 内部运行，可以在界面上绘制内容。终端和 Claude 桌面 App 的 Code 标签页都能用。

### inline-next-steps

Claude 在最终回答的末尾列出你接下来可能会问的事情。这个列表在对话里是隐藏的，以复选框的形式显示在输入框上方。勾选几项后，它们会被填进输入框，你可以先修改，确认后再发送。**不会额外调用任何模型。**

**安装**

```bash
claude plugin marketplace add shijieli708-ship-it/claude-mods
claude plugin install inline-next-steps@claude-mods
```

然后新开一个会话，或者在已打开的会话里运行 `/reload-plugins`。

**原理**

1. 你每发一条消息，mod 会附上一段你看不到的简短说明，让 Claude 在最终回答末尾写一个 `<next-steps>` 块：做事类请求给 2–6 个下一步，普通知识问答给 1–3 个延伸问题。
2. 这个块只从界面显示上去掉，存储的对话记录不动，所以模型的思考块依然有效。
3. 一轮结束后，这个块会变成输入框上方的复选框。
4. 点 “Put in prompt” 后，勾选的内容会填进输入框，多条会自动编号，不会自动发送。

**成本**：每轮大约多 100 个输出 token，外加约 250 个输入 token 的说明，这部分之后会被缓存。建议是由正在回答的模型顺便写的，它本来就有完整的上下文，所以不需要第二个模型再读一遍对话。

**局限**：模型偶尔会漏写这个块或写错格式，这一轮就不会出现按钮。在 VS Code 聊天面板和 `claude -p` 里不会附加说明，所以也不会出现块的原文。
