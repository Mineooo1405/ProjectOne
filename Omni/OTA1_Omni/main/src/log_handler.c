#include "log_handler.h"
#include "esp_log.h"
#include "lwip/sockets.h"
#include <stdarg.h>

#include "sys_config.h"
// Socket tĩnh, chỉ được truy cập trong module này
static int client_socket = -1;

void log_to_tcp(const char *format, va_list args)
{
    if (client_socket > 0)
    {
        char buffer[256];
        char json_buffer[512]; // Tăng kích thước buffer để đảm bảo đủ cho JSON
        int len = vsnprintf(buffer, sizeof(buffer), format, args);
        if (len > 0)
        {
            if (len < sizeof(buffer) && buffer[len - 1] == '\n')
            {
                buffer[len - 1] = '\0';
                len--;
            }

            // Loại bỏ carriage return cuối cùng nếu có
            if (len > 0 && buffer[len - 1] == '\r')
            {
                buffer[len - 1] = '\0';
                len--;
            }
            // Format thành JSON với các trường theo yêu cầu
            int json_len = snprintf(json_buffer, sizeof(json_buffer),
                                    "{\"id\":%d,\"type\":\"log\",\"message\":\"%s\"}\n",
                                    ID_ROBOT, buffer);

            // Gửi JSON buffer qua socket
            send(client_socket, json_buffer, json_len, 0);
        }
    }
}
void log_init(int socket)
{
    client_socket = socket;          // Lưu socket client
    esp_log_set_vprintf(log_to_tcp); // Redirect log sang TCP
    esp_log_level_set("*", ESP_LOG_WARN);
}
