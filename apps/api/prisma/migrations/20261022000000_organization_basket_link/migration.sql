-- Vínculo operacional da cesta com a ONG e coordenadas aproximadas de partida.
ALTER TABLE "cesta" ADD COLUMN "id_ong" INTEGER;
ALTER TABLE "ong" ADD COLUMN "latitude" DECIMAL(9,6);
ALTER TABLE "ong" ADD COLUMN "longitude" DECIMAL(9,6);
ALTER TABLE "cesta" ADD CONSTRAINT "cesta_id_ong_fkey" FOREIGN KEY ("id_ong") REFERENCES "ong"("id_ong") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "cesta_id_ong_idx" ON "cesta"("id_ong");
