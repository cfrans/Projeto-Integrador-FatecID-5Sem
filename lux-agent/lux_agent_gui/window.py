import os
from datetime import datetime, timezone

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gdk, GLib, Gio, Gtk

from .session import (
    AUTHORIZING, HELPER_PATH, IDLE, NOT_INSTALLED, RUNNING, State,
    finish, format_remaining, parse_event, qr_matrix, qr_pixels, remaining_seconds,
)

APP_ID = "org.piplup.Pairing"
ACCENT = "#E5483D"
SUCCESS = "#4CAF7A"
QR_SCALE = 6

PAGES = {
    "idle": (APP_ID, "Parear este computador",
             "Conecte este computador ao app Piplup do responsável. Será pedida a senha de um administrador.",
             "Parear"),
    "authorizing": (None, "Aguardando autorização",
                    "Digite a senha de administrador na janela de autenticação.", None),
    "qr": (None, "Escaneie com o app Piplup",
           "No celular do responsável, abra o Piplup, leia o código e confirme o pareamento. "
           "Mantenha esta janela aberta até a confirmação.", None),
    "paired": ("object-select-symbolic", "Computador pareado",
               "O Piplup já está sincronizando este computador. Você pode fechar esta janela.", "Fechar"),
    "already-paired": ("object-select-symbolic", "Computador já pareado",
                       "Este computador já está vinculado a um responsável no app Piplup.", "Fechar"),
    "expired": ("alarm-symbolic", "O código expirou",
                "Gere um novo código. A senha de administrador será pedida de novo.", "Gerar novo código"),
    "error": ("dialog-error-symbolic", "Não foi possível parear", "", "Tentar novamente"),
    "denied": ("dialog-password-symbolic", "Autorização necessária",
               "O pareamento exige a senha de um administrador deste computador.", "Tentar novamente"),
    "not-installed": ("dialog-warning-symbolic", "Piplup não instalado",
                      "Instale o Lux Agent com o install.sh antes de parear este computador.", None),
}


def qr_picture(uri: str) -> Gtk.Picture:
    size, pixels = qr_pixels(qr_matrix(uri), QR_SCALE)
    texture = Gdk.MemoryTexture.new(size, size, Gdk.MemoryFormat.R8G8B8, GLib.Bytes.new(pixels), size * 3)
    picture = Gtk.Picture.new_for_paintable(texture)
    picture.set_can_shrink(False)
    picture.set_halign(Gtk.Align.CENTER)
    picture.set_overflow(Gtk.Overflow.HIDDEN)
    picture.add_css_class("qr")
    picture.update_property([Gtk.AccessibleProperty.LABEL], ["Código QR de pareamento"])
    return picture


def spinner() -> Gtk.Widget:
    if hasattr(Adw, "Spinner"):
        widget = Adw.Spinner()
    else:
        widget = Gtk.Spinner(spinning=True)
    widget.set_size_request(48, 48)
    widget.set_halign(Gtk.Align.CENTER)
    return widget


class PairingWindow(Adw.ApplicationWindow):
    def __init__(self, application: Adw.Application):
        super().__init__(application=application, title="Piplup", default_width=440, default_height=640)
        self.page = Adw.StatusPage()
        toolbar = Adw.ToolbarView()
        toolbar.add_top_bar(Adw.HeaderBar())
        toolbar.set_content(self.page)
        self.set_content(toolbar)
        self.state = IDLE
        self.seen_event = False
        self.timer = 0
        self.countdown: Gtk.Label | None = None
        self.show_state(IDLE if os.path.exists(HELPER_PATH) else NOT_INSTALLED)

    def show_state(self, state: State) -> None:
        if self.timer:
            GLib.source_remove(self.timer)
            self.timer = 0
        if state.kind == "qr":
            try:
                picture = qr_picture(state.uri)
            except ImportError:
                state = NOT_INSTALLED
        self.state = state
        icon, title, description, action = PAGES[state.kind]
        self.page.set_icon_name(icon)
        if state.kind == "paired":
            self.page.add_css_class("paired")
        else:
            self.page.remove_css_class("paired")
        self.page.set_title(title)
        self.page.set_description(state.message or description)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        if state.kind == "authorizing":
            box.append(spinner())
        elif state.kind == "qr":
            box.append(picture)
            self.countdown = Gtk.Label(css_classes=["title-4", "numeric"])
            box.append(self.countdown)
            self.tick()
            self.timer = GLib.timeout_add_seconds(1, self.tick)
        if action:
            button = Gtk.Button(label=action, halign=Gtk.Align.CENTER, css_classes=["pill", "suggested-action"])
            button.connect("clicked", lambda _: self.close() if state.kind in ("paired", "already-paired") else self.start())
            box.append(button)
        self.page.set_child(box)

    def tick(self) -> bool:
        if self.state.kind != "qr" or self.countdown is None or self.state.expires_at is None:
            return False
        seconds = remaining_seconds(self.state.expires_at, datetime.now(timezone.utc))
        self.countdown.set_label(f"Expira em {format_remaining(seconds)}")
        return True

    def start(self) -> None:
        if not os.path.exists(HELPER_PATH):
            self.show_state(NOT_INSTALLED)
            return
        try:
            process = Gio.Subprocess.new(["pkexec", HELPER_PATH], Gio.SubprocessFlags.STDOUT_PIPE)
        except GLib.Error:
            self.show_state(State("error", message="pkexec não encontrado; reinstale o Lux Agent."))
            return
        self.seen_event = False
        self.show_state(AUTHORIZING)
        stream = Gio.DataInputStream.new(process.get_stdout_pipe())
        stream.read_line_async(GLib.PRIORITY_DEFAULT, None, self.on_line, process)

    def on_line(self, stream: Gio.DataInputStream, result: Gio.AsyncResult, process: Gio.Subprocess) -> None:
        try:
            line, _ = stream.read_line_finish_utf8(result)
        except GLib.Error:
            line = None
        if line is None:
            process.wait_async(None, self.on_exit)
            return
        state = parse_event(line)
        if state is not None:
            self.seen_event = True
            self.show_state(state)
        stream.read_line_async(GLib.PRIORITY_DEFAULT, None, self.on_line, process)

    def on_exit(self, process: Gio.Subprocess, result: Gio.AsyncResult) -> None:
        try:
            process.wait_finish(result)
        except GLib.Error:
            pass
        code = process.get_exit_status() if process.get_if_exited() else -1
        state = finish(self.state, self.seen_event, code)
        if state != self.state:
            self.show_state(state)


class PairingApplication(Adw.Application):
    def __init__(self):
        super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.DEFAULT_FLAGS)

    def do_startup(self) -> None:
        Adw.Application.do_startup(self)
        Gtk.Window.set_default_icon_name(APP_ID)
        if Adw.get_minor_version() >= 6:
            accent = f":root {{ --accent-bg-color: {ACCENT}; }}"
        else:
            accent = f"@define-color accent_bg_color {ACCENT}; @define-color accent_color {ACCENT};"
        provider = Gtk.CssProvider()
        provider.load_from_string(accent + f" .qr {{ border-radius: 12px; }} .paired .icon {{ color: {SUCCESS}; }}")
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )

    def do_activate(self) -> None:
        window = self.props.active_window or PairingWindow(self)
        window.present()


def main() -> int:
    return PairingApplication().run(None)
