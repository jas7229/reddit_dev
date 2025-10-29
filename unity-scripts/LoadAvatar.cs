using System;
using System.Collections;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.UI;

public class LoadAvatar : MonoBehaviour
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern IntPtr GetUserAvatar();
#else
    private static IntPtr GetUserAvatar() => IntPtr.Zero; // Editor fallback
#endif

    [SerializeField] private Image avatarImage;

    public void LoadAvatar1() => StartCoroutine(LoadAvatarCoroutine());

    private string GetAvatarString()
    {
        IntPtr ptr = GetUserAvatar();
        return Marshal.PtrToStringUTF8(ptr);
    }

    private IEnumerator LoadAvatarCoroutine()
    {
        string url = GetAvatarString();
        

        if (string.IsNullOrEmpty(url))
        {
            Debug.LogWarning("Avatar URL is empty!");
            yield break;
        }

        using (UnityWebRequest uwr = UnityWebRequestTexture.GetTexture(url))
        {
            yield return uwr.SendWebRequest();

            if (uwr.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError("Avatar load failed: " + uwr.error);
                yield break;
            }

            Texture2D tex = DownloadHandlerTexture.GetContent(uwr);

            // Convert to Sprite for Image
            Sprite sprite = Sprite.Create(tex,
                new Rect(0, 0, tex.width, tex.height),
                new Vector2(0.5f, 0.5f));

            avatarImage.sprite = sprite;
        }
    }
}
