import { AppError } from "../../shared/errors/app-error.js";

import { familyRepository } from "./family.repository.js";
import { decryptAddress } from "../../shared/security/private-address.js";

export const familyService = {
  async getMyProfile(idUsuario: number) {
    const family = await familyRepository.findByUserId(idUsuario);

    if (!family) {
      throw new AppError(
        "Perfil familiar não encontrado.",
        404,
        "FAMILY_NOT_FOUND",
      );
    }

    return { ...family, endereco: family.endereco ? { idEndereco: family.endereco.idEndereco, endereco: decryptAddress(family.endereco.enderecoProtegido), latitude: family.endereco.latitude, longitude: family.endereco.longitude } : null };
  },

  async validateAidRequest(idUsuario: number) {
    const family = await familyRepository.findByUserId(idUsuario);

    if (!family) {
      throw new AppError(
        "Perfil familiar não encontrado.",
        404,
        "FAMILY_NOT_FOUND",
      );
    }

    if (family.status !== "ATIVA") {
      throw new AppError(
        "O cadastro da família não está ativo.",
        403,
        "FAMILY_NOT_ACTIVE",
      );
    }

    const activeBasket = await familyRepository.findActiveBasket(
      family.idFamilia,
    );

    if (activeBasket) {
      throw new AppError(
        "Já existe uma solicitação de auxílio em andamento.",
        409,
        "ACTIVE_AID_REQUEST_EXISTS",
      );
    }

    return family;
  },
};
