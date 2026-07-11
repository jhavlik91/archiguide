// Test stub pro `server-only`. V produkci/Next buildu je `server-only` guard,
// který zabrání importu server modulu do klientského bundlu. V testech (vitest)
// žádný takový bundle není, takže guard nahrazujeme prázdným modulem, aby šlo
// server moduly (service, image, usage, …) přímo unit-testovat.
export {};
