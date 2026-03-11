import httpService from "../services/httpService";

export const uploadDocumentApi = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  console.log(file,'file')
  return httpService.post("documents/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const getDocumentsApi = async () => {
  return httpService.get("documents");
};

export const deleteDocumentApi = async (id: string) => {
  return httpService.delete(`documents/${id}`);
};

export const renameDocumentApi = async (id: string, name: string) => {
  return httpService.patch(`documents/${id}/rename`, {
    fileName: name,
  });
};