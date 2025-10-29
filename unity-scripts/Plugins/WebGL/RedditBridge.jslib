mergeInto(LibraryManager.library, {
  GetUserAvatar: function () {
    // Devvit should populate window.userAvatar with the live URL
    var avatar = window.userAvatar || "https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfNDhhM2EwNDI0Nzg0N2VkMzUwOGI4YjRjZjdlNzIwMjViNDY5NTcwMl8z_rare_e85ca617-5a92-4b1f-a9a3-0e8631571a20.png";
    console.log("GetUserAvatar called, URL:", avatar); // DEBUG
    return stringToNewUTF8(avatar);
  }
});