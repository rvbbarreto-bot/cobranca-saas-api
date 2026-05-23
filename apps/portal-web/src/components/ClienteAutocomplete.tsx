import { useEffect, useId, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ClienteRow } from "../lib/api";
import { fetchClientes } from "../lib/api";

const PAGE_SIZE = 25;

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (clienteId: string, cliente?: ClienteRow) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  initialCliente?: ClienteRow | null;
};

export function ClienteAutocomplete({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
  error,
  initialCliente
}: Props): JSX.Element {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");

  useEffect(() => {
    if (initialCliente && initialCliente.id === value) {
      setSelectedLabel(`${initialCliente.nome} (${initialCliente.documento})`);
    }
  }, [initialCliente, value]);

  const q = useInfiniteQuery({
    queryKey: ["clientes-search", query],
    queryFn: ({ pageParam }) =>
      fetchClientes({
        limit: PAGE_SIZE,
        cursor: pageParam ?? null,
        search: query.trim().length >= 2 ? query.trim() : undefined
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: open,
    staleTime: 30_000
  });

  const options = q.data?.pages.flatMap((p) => p.data) ?? [];

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function selectCliente(c: ClienteRow | null): void {
    if (!c) {
      onChange("", undefined);
      setSelectedLabel("");
    } else {
      onChange(c.id, c);
      setSelectedLabel(`${c.nome} (${c.documento})`);
    }
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="cliente-autocomplete" ref={wrapRef}>
      <label htmlFor={id}>
        {label}
        {required ? <span className="field-required" aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        required={required && !value}
        value={open ? query : selectedLabel || (value ? "Cliente selecionado" : "")}
        placeholder="Buscar por nome ou documento…"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) {
            selectCliente(null);
          }
        }}
      />
      {open ? (
        <ul id={listId} className="cliente-autocomplete__list" role="listbox">
          <li>
            <button type="button" className="cliente-autocomplete__option" onClick={() => selectCliente(null)}>
              — Nao associar —
            </button>
          </li>
          {q.isLoading ? (
            <li className="cliente-autocomplete__hint">Carregando…</li>
          ) : null}
          {options.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="cliente-autocomplete__option"
                role="option"
                aria-selected={c.id === value}
                onClick={() => selectCliente(c)}
              >
                {c.nome} ({c.documento})
              </button>
            </li>
          ))}
          {q.hasNextPage ? (
            <li>
              <button
                type="button"
                className="cliente-autocomplete__more"
                disabled={q.isFetchingNextPage}
                onClick={() => void q.fetchNextPage()}
              >
                {q.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
              </button>
            </li>
          ) : null}
          {!q.isLoading && options.length === 0 && query.trim().length >= 2 ? (
            <li className="cliente-autocomplete__hint">Nenhum cliente encontrado.</li>
          ) : null}
        </ul>
      ) : null}
      {error ? <span className="err">{error}</span> : null}
    </div>
  );
}
