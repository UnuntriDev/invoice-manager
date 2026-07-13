import prisma from "@/lib/prisma";
import type { ContractorCreate } from "@/lib/validators/schemas";

export async function listContractors() {
  return prisma.contractor.findMany({
    include: { defaultCategory: true },
    orderBy: { name: "asc" },
  });
}

export async function getContractor(id: string) {
  return prisma.contractor.findUnique({
    where: { id },
    include: { defaultCategory: true },
  });
}

export async function createContractor(data: ContractorCreate) {
  return prisma.contractor.create({
    data,
    include: { defaultCategory: true },
  });
}

export async function updateContractor(id: string, data: Partial<ContractorCreate>) {
  return prisma.contractor.update({
    where: { id },
    data,
    include: { defaultCategory: true },
  });
}

export async function deleteContractor(id: string) {
  return prisma.contractor.delete({ where: { id } });
}

export async function findContractorByNip(nip: string) {
  return prisma.contractor.findUnique({
    where: { nip },
    include: { defaultCategory: true },
  });
}
