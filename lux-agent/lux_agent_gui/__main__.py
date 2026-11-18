import sys


def main() -> int:
    try:
        from .window import main as run
    except (ImportError, ValueError):
        sys.stderr.write("Erro: GTK 4 e libadwaita não encontrados (gir1.2-gtk-4.0, gir1.2-adw-1); reinstale o Lux Agent.\n")
        return 2
    return run()


if __name__ == "__main__":
    sys.exit(main())
